import { describe, it, expect } from "vitest";
import {
  suggestPayments,
  verifySuggestedPayments,
  EXACT_MEMBER_LIMIT,
  MAX_PLAN_PAYMENTS,
  type NetBalance,
} from "@/features/settlements/engine";
function balances(values: bigint[]): NetBalance[] {
  return values.map((netPoisha, i) => ({ memberId: "m" + i, netPoisha }));
}
function check(values: bigint[]) {
  const input = balances(values),
    result = suggestPayments(input);
  expect(verifySuggestedPayments(input, result.payments)).toBe(true);
  expect(values.reduce((s, v) => s + v, 0n)).toBe(0n);
  expect(
    result.payments.every((p) => p.fromId !== p.toId && p.amountPoisha > 0n),
  ).toBe(true);
  expect(result).toEqual(suggestPayments([...input].reverse()));
  return result;
}
describe("pure settlement suggestions", () => {
  it("exact plans agree with independent exhaustive payment-state search on tiny ledgers", () => {
    function minimum(initial: bigint[]) {
      let states = [initial];
      const seen = new Set([initial.join(",")]);
      for (let depth = 0; states.length; depth++) {
        const next: bigint[][] = [];
        for (const state of states) {
          if (state.every((n) => n === 0n)) return depth;
          for (let from = 0; from < state.length; from++)
            for (let to = 0; to < state.length; to++) {
              if (state[from] >= 0n || state[to] <= 0n) continue;
              const limit = -state[from] < state[to] ? -state[from] : state[to];
              for (let paid = 1n; paid <= limit; paid++) {
                const updated = [...state];
                updated[from] += paid;
                updated[to] -= paid;
                const key = updated.join(",");
                if (!seen.has(key)) {
                  seen.add(key);
                  next.push(updated);
                }
              }
            }
        }
        states = next;
      }
      throw new Error("No complete payment path.");
    }
    for (let a = 1n; a <= 3n; a++)
      for (let b = 1n; b <= 3n; b++)
        for (let c = 1n; c < a + b; c++) {
          const values = [-a, -b, c, a + b - c],
            result = check(values);
          expect(result.minimumGuaranteed).toBe(true);
          expect(result.payments.length).toBe(minimum(values));
        }
  });
  it("uses exact search at the ten-member boundary", () => {
    const result = check([-1n, -2n, -3n, -4n, -5n, 1n, 2n, 3n, 4n, 5n]);
    expect(result.algorithm).toBe("EXACT");
    expect(result.payments).toHaveLength(5);
  });
  it("one debtor and one creditor", () => {
    expect(check([-100n, 100n]).payments).toEqual([
      { fromId: "m0", toId: "m1", amountPoisha: 100n },
    ]);
  });
  it("multiple debtors, one creditor", () => {
    expect(check([-20n, -30n, 50n]).payments).toHaveLength(2);
  });
  it("one debtor, multiple creditors", () => {
    expect(check([-50n, 20n, 30n]).payments).toHaveLength(2);
  });
  it("multiple debtors and creditors", () => {
    check([-90n, -60n, 40n, 70n, 40n]);
  });
  it("exact zeros, empty groups and zero members need no payment", () => {
    expect(check([0n, 0n]).payments).toEqual([]);
    expect(check([]).payments).toEqual([]);
    check([-1n, 0n, 1n]);
  });
  it("known greedy counterexample: five greedy payments versus four exact payments", () => {
    const input = balances([-8n, -7n, -6n, 9n, 8n, 4n]);
    const exact = suggestPayments(input),
      greedy = suggestPayments(input, "GREEDY");
    expect(exact.payments).toHaveLength(4);
    expect(exact.minimumGuaranteed).toBe(true);
    expect(greedy.payments).toHaveLength(5);
    expect(greedy.minimumGuaranteed).toBe(false);
    expect(verifySuggestedPayments(input, greedy.payments)).toBe(true);
  });
  it("threshold fallback is deterministic greedy and never claims minimum", () => {
    const result = check([
      ...Array<bigint>(EXACT_MEMBER_LIMIT / 2 + 1).fill(-1n),
      ...Array<bigint>(EXACT_MEMBER_LIMIT / 2 + 1).fill(1n),
    ]);
    expect(result.algorithm).toBe("GREEDY");
    expect(result.minimumGuaranteed).toBe(false);
  });
  it("splits large obligations into bounded recordable payments", () => {
    const result = check([-200000001n, 200000001n]);
    expect(result.algorithm).toBe("GREEDY");
    expect(result.payments.map((p) => p.amountPoisha)).toEqual([
      100000000n,
      100000000n,
      1n,
    ]);
  });
  it("protects against unbounded payment output", () => {
    expect(() =>
      suggestPayments(
        balances([
          -BigInt(MAX_PLAN_PAYMENTS + 1) * 100000000n,
          BigInt(MAX_PLAN_PAYMENTS + 1) * 100000000n,
        ]),
      ),
    ).toThrow(/too many/);
  });
  it("rejects unbalanced inputs, duplicate/invalid IDs and Number money", () => {
    expect(() => suggestPayments(balances([-1n, 2n]))).toThrow();
    expect(() =>
      suggestPayments([
        { memberId: "a", netPoisha: -1n },
        { memberId: "a", netPoisha: 1n },
      ]),
    ).toThrow();
    expect(() =>
      suggestPayments([{ memberId: "bad id", netPoisha: 0n }]),
    ).toThrow();
    expect(() =>
      suggestPayments([{ memberId: "a", netPoisha: 0 as unknown as bigint }]),
    ).toThrow();
  });
  it("rejects self, zero, negative, unknown, overpayment and incomplete plans", () => {
    for (const p of [
      { fromId: "m0", toId: "m0", amountPoisha: 1n },
      { fromId: "m0", toId: "m1", amountPoisha: 0n },
      { fromId: "m0", toId: "m1", amountPoisha: -1n },
      { fromId: "other", toId: "m1", amountPoisha: 1n },
      { fromId: "m0", toId: "m1", amountPoisha: 101n },
      { fromId: "m0", toId: "m1", amountPoisha: 99n },
    ])
      expect(() =>
        verifySuggestedPayments(balances([-100n, 100n]), [p]),
      ).toThrow();
  });
  it("does not mutate the input", () => {
    const input = Object.freeze(
      balances([-1n, 1n]).map((b) => Object.freeze(b)),
    );
    suggestPayments(input);
    expect(input[0].netPoisha).toBe(-1n);
  });
  it("clears 1000 generated small ledgers, never doing worse than greedy", () => {
    for (let i = 1; i <= 1000; i++) {
      const values = [
        -BigInt(i),
        -BigInt(i * 2),
        -BigInt(i * 3),
        BigInt(i + 1),
        BigInt(i * 2 + 2),
        BigInt(i * 3 - 3),
      ];
      const input = balances(values),
        result = check(values),
        greedy = suggestPayments(input, "GREEDY");
      expect(result.payments.length).toBeLessThanOrEqual(
        greedy.payments.length,
      );
    }
  });
});
