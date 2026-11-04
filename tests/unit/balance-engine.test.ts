import { describe, it, expect } from "vitest";
import {
  calculateBalances,
  currentUserBalance,
  type LedgerExpense,
  type LedgerInput,
} from "@/features/balances/engine";
const memberIds = ["A", "B", "C"];
function expense(
  amountPoisha: bigint,
  values: bigint[],
  paidById = "A",
): LedgerExpense {
  return {
    id: "expense-1",
    groupId: "group",
    paidById,
    amountPoisha,
    splits: values.map((amountPoisha, i) => ({
      memberId: memberIds[i],
      amountPoisha,
    })),
  };
}
function ledger(
  expenses: LedgerExpense[] = [],
  settlements: LedgerInput["settlements"] = [],
) {
  return { groupId: "group", memberIds, expenses, settlements };
}
function check(input: LedgerInput, expected: bigint[]) {
  const result = calculateBalances(input);
  expect(result.members.map((m) => m.netPoisha)).toEqual(expected);
  expect(result.groupTotalPoisha).toBe(0n);
  expect(result.members.reduce((sum, m) => sum + m.netPoisha, 0n)).toBe(0n);
  expect(result.zeroSumVerified).toBe(true);
  for (const e of result.expenses)
    expect(e.contributions.reduce((sum, c) => sum + c.netPoisha, 0n)).toBe(0n);
  for (const s of result.settlements)
    expect(s.contributions.reduce((sum, c) => sum + c.netPoisha, 0n)).toBe(0n);
  return result;
}
describe("pure group balances — BigInt poisha, positive is owed", () => {
  it("scenario 1 expected result: A pays 4000 BDT; A/B allocated 2000 each, C zero", () => {
    check(ledger([expense(400000n, [200000n, 200000n, 0n])]), [
      200000n,
      -200000n,
      0n,
    ]);
  });
  it("scenario 1 literal wording: B/C allocated 2000 BDT each gives A +4000, B/C -2000", () => {
    check(ledger([expense(400000n, [0n, 200000n, 200000n])]), [
      400000n,
      -200000n,
      -200000n,
    ]);
  });
  it("scenario 2 actual 1000 BDT: saved 33333/33333/33334 poisha", () => {
    check(ledger([expense(100000n, [33333n, 33333n, 33334n])]), [
      66667n,
      -33333n,
      -33334n,
    ]);
  });
  it("scenario 2 supplied expected numbers correspond to 100 BDT", () => {
    check(ledger([expense(10000n, [3333n, 3333n, 3334n])]), [
      6667n,
      -3333n,
      -3334n,
    ]);
  });
  it("scenario 3: A pays 2000 BDT exclusively for B", () => {
    check(ledger([expense(200000n, [0n, 200000n])]), [200000n, -200000n, 0n]);
  });
  it("scenario 4: A pays 1000 BDT for B, then B settles 400 BDT to A", () => {
    const result = check(
      ledger(
        [expense(100000n, [0n, 100000n])],
        [
          {
            id: "settlement-1",
            groupId: "group",
            fromId: "B",
            toId: "A",
            amountPoisha: 40000n,
          },
        ],
      ),
      [60000n, -60000n, 0n],
    );
    expect(currentUserBalance(result, "A")).toEqual({
      netPoisha: 60000n,
      owedByPoisha: 0n,
      owedToPoisha: 60000n,
    });
    expect(currentUserBalance(result, "B")).toEqual({
      netPoisha: -60000n,
      owedByPoisha: 60000n,
      owedToPoisha: 0n,
    });
    expect(currentUserBalance(result, "C")).toEqual({
      netPoisha: 0n,
      owedByPoisha: 0n,
      owedToPoisha: 0n,
    });
    expect(result.members[0]).toMatchObject({
      paidPoisha: 100000n,
      allocatedPoisha: 0n,
      receivedPoisha: 40000n,
    });
    expect(result.members[1]).toMatchObject({
      sentPoisha: 40000n,
      allocatedPoisha: 100000n,
    });
  });
  it("scenario 5: replacing an old expense's saved allocations recalculates all contributions", () => {
    check(ledger([expense(100000n, [0n, 100000n])]), [100000n, -100000n, 0n]);
    check(ledger([expense(200000n, [50000n, 100000n, 50000n])]), [
      150000n,
      -100000n,
      -50000n,
    ]);
  });
  it("empty ledger and self-paid expense are settled", () => {
    check(ledger(), [0n, 0n, 0n]);
    check(ledger([expense(100n, [100n])]), [0n, 0n, 0n]);
  });
  it("uses persisted one-poisha allocations instead of recomputing equal splits", () => {
    check(ledger([expense(1n, [0n, 0n, 1n])]), [1n, 0n, -1n]);
  });
  it("full settlement returns both members to zero", () => {
    check(
      ledger(
        [expense(100n, [0n, 100n])],
        [
          {
            id: "s",
            groupId: "group",
            fromId: "B",
            toId: "A",
            amountPoisha: 100n,
          },
        ],
      ),
      [0n, 0n, 0n],
    );
  });
  it("preserves historical members and is independent of expense ordering", () => {
    const first = expense(100n, [0n, 100n]);
    const second = { ...expense(70n, [0n, 0n, 70n], "B"), id: "expense-2" };
    const result = check(ledger([first, second]), [100n, -30n, -70n]);
    const reordered = check(ledger([second, first]), [100n, -30n, -70n]);
    expect(reordered.members).toEqual(result.members);
  });
  it("does not mutate frozen ledger records", () => {
    const e = Object.freeze({
      ...expense(100n, [0n, 100n]),
      splits: Object.freeze([
        Object.freeze({ memberId: "B", amountPoisha: 100n }),
      ]),
    });
    check(
      {
        ...ledger(),
        memberIds: Object.freeze(memberIds),
        expenses: Object.freeze([e]),
        settlements: Object.freeze([]),
      },
      [100n, -100n, 0n],
    );
  });
  const invalid = [
    {
      label: "nonconserving allocation",
      change: () => ledger([expense(100n, [20n, 20n])]),
    },
    {
      label: "negative allocation",
      change: () => ledger([expense(100n, [-1n, 101n])]),
    },
    { label: "zero total", change: () => ledger([expense(0n, [0n])]) },
    {
      label: "Number money",
      change: () => ledger([expense(100 as unknown as bigint, [100n])]),
    },
    { label: "missing splits", change: () => ledger([expense(100n, [])]) },
    {
      label: "unknown member",
      change: () =>
        ledger([{ ...expense(100n, [100n]), paidById: "outsider" }]),
    },
    {
      label: "cross-group expense",
      change: () => ledger([{ ...expense(100n, [100n]), groupId: "other" }]),
    },
    {
      label: "duplicate expense",
      change: () => ledger([expense(100n, [100n]), expense(100n, [100n])]),
    },
    {
      label: "duplicate split member",
      change: () =>
        ledger([
          {
            ...expense(100n, [100n]),
            splits: [
              { memberId: "B", amountPoisha: 50n },
              { memberId: "B", amountPoisha: 50n },
            ],
          },
        ]),
    },
    {
      label: "duplicate roster",
      change: () => ({ ...ledger(), memberIds: ["A", "A"] }),
    },
  ];
  it.each(invalid)("fails visibly on $label", ({ change }) => {
    expect(() => calculateBalances(change())).toThrow();
  });
  it.each([
    { fromId: "A", toId: "A", amountPoisha: 1n },
    { fromId: "B", toId: "A", amountPoisha: -1n },
    { fromId: "B", toId: "A", amountPoisha: 0n },
    { fromId: "outside", toId: "A", amountPoisha: 1n },
    { fromId: "B", toId: "A", amountPoisha: 1n, groupId: "other" },
  ])("rejects invalid persisted settlement $fromId/$toId/$amountPoisha", (change) => {
    expect(() =>
      calculateBalances(ledger([], [{ id: "s", groupId: "group", ...change }])),
    ).toThrow();
  });
  it("rejects duplicate settlement IDs", () => {
    const s = {
      id: "s",
      groupId: "group",
      fromId: "B",
      toId: "A",
      amountPoisha: 1n,
    };
    expect(() => calculateBalances(ledger([], [s, s]))).toThrow();
  });
  it("reconciles member breakdown totals across 1000 generated ledgers", () => {
    for (let n = 1; n <= 1000; n++) {
      const total = BigInt(n * 19),
        a = BigInt(n * 3),
        b = BigInt(n * 5),
        c = total - a - b,
        payment = BigInt(n);
      const result = check(
        ledger(
          [expense(total, [a, b, c])],
          [
            {
              id: "s",
              groupId: "group",
              fromId: "C",
              toId: "A",
              amountPoisha: payment,
            },
          ],
        ),
        [total - a - payment, -b, -c + payment],
      );
      for (const m of result.members)
        expect(m.netPoisha).toBe(
          m.paidPoisha - m.allocatedPoisha + m.sentPoisha - m.receivedPoisha,
        );
    }
  });
});
