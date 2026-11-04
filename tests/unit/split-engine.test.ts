import { describe, it, expect } from "vitest";
import {
  equalSplit,
  exactSplit,
  percentageSplit,
  sharesSplit,
  type Allocation,
} from "@/features/expenses/split-engine";
import {
  parsePoisha,
  parseBasisPoints,
  parseWeight,
  formatPoisha,
  poishaToDecimal,
} from "@/features/expenses/money";
const ids = ["a", "b", "c"];
function conserved(total: bigint, allocations: Allocation[]) {
  expect(allocations.reduce((sum, a) => sum + a.amount, 0n)).toBe(total);
  expect(
    allocations.every((a) => a.amount >= 0n && typeof a.amount === "bigint"),
  ).toBe(true);
}
describe("EQUAL — exact poisha and deterministic rotation", () => {
  it.each([
    { total: 10000n, members: ids, expected: [3333n, 3333n, 3334n] },
    { total: 1n, members: ids, expected: [0n, 0n, 1n] },
    {
      total: 9999n,
      members: [...ids, "d"],
      expected: [2499n, 2500n, 2500n, 2500n],
    },
  ])("$total poisha / $members", ({ total, members, expected }) => {
    const result = equalSplit(total, members, "expense-001");
    expect(
      result.map((a) => a.amount).sort((a, b) => (a < b ? -1 : 1)),
    ).toEqual(expected);
    conserved(total, result);
  });
  it("is stable across calls and input order, and rotates tied remainder winners", () => {
    const winners = new Set();
    for (let n = 0; n < 30; n++) {
      const result = equalSplit(1n, ids, "expense-" + n);
      expect(result).toEqual(
        equalSplit(1n, [...ids].reverse(), "expense-" + n),
      );
      winners.add(result.find((a) => a.amount === 1n)!.memberId);
    }
    expect(winners.size).toBe(3);
  });
});
describe("EXACT", () => {
  it("accepts a correct sum including zero shares", () => {
    const result = exactSplit(10000n, ids, [
      { memberId: "a", amount: 5000n },
      { memberId: "b", amount: 5000n },
      { memberId: "c", amount: 0n },
    ]);
    conserved(10000n, result);
  });
  it("rejects incorrect sums", () => {
    expect(() =>
      exactSplit(100n, ["a"], [{ memberId: "a", amount: 99n }]),
    ).toThrow(/add up/);
  });
  it("rejects negative shares", () => {
    expect(() =>
      exactSplit(
        100n,
        ["a", "b"],
        [
          { memberId: "a", amount: -1n },
          { memberId: "b", amount: 101n },
        ],
      ),
    ).toThrow(/non-negative/);
  });
  it("rejects missing or extra participant values", () => {
    expect(() =>
      exactSplit(100n, ["a", "b"], [{ memberId: "a", amount: 100n }]),
    ).toThrow(/Every included/);
    expect(() =>
      exactSplit(
        100n,
        ["a"],
        [
          { memberId: "a", amount: 100n },
          { memberId: "b", amount: 0n },
        ],
      ),
    ).toThrow(/Every included/);
  });
});
describe("PERCENTAGE — integer basis points", () => {
  it.each([
    [5000, 3000, 2000],
    [3333, 3333, 3334],
  ])(
    "accepts %j basis points and conserves the total",
    (...points: number[]) => {
      const result = percentageSplit(
        10000n,
        ids,
        ids.map((memberId, i) => ({ memberId, basisPoints: points[i] })),
        "expense",
      );
      expect(result.map((a) => a.amount)).toEqual(points.map(BigInt));
      conserved(10000n, result);
    },
  );
  it("uses largest fractional remainder before tie order", () => {
    expect(
      percentageSplit(
        1n,
        ids,
        [
          { memberId: "a", basisPoints: 2000 },
          { memberId: "b", basisPoints: 3000 },
          { memberId: "c", basisPoints: 5000 },
        ],
        "expense",
      ).find((a) => a.amount === 1n)?.memberId,
    ).toBe("c");
  });
  it.each([9999, 10001])("rejects a total of %i basis points", (sum) => {
    expect(() =>
      percentageSplit(
        100n,
        ["a", "b"],
        [
          { memberId: "a", basisPoints: 5000 },
          { memberId: "b", basisPoints: sum - 5000 },
        ],
        "expense",
      ),
    ).toThrow(/exactly 100/);
  });
  it("rejects invalid percentage precision and fractional basis points", () => {
    expect(parseBasisPoints("50.25")).toBe(5025);
    expect(() => parseBasisPoints("33.333")).toThrow();
    expect(() =>
      percentageSplit(
        100n,
        ["a"],
        [{ memberId: "a", basisPoints: 9999.5 }],
        "expense",
      ),
    ).toThrow();
  });
});
describe("SHARES", () => {
  it("rotates equal percentage and share remainders, independently of input order", () => {
    const percentageWinners = new Set<string>();
    const shareWinners = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const p = [
        { memberId: "a", basisPoints: 5000 },
        { memberId: "b", basisPoints: 5000 },
      ];
      const s = [
        { memberId: "a", weight: 1n },
        { memberId: "b", weight: 1n },
      ];
      const percent = percentageSplit(1n, ["a", "b"], p, "tie-" + seed);
      const shares = sharesSplit(1n, ["a", "b"], s, "tie-" + seed);
      expect(percent).toEqual(
        percentageSplit(1n, ["b", "a"], [...p].reverse(), "tie-" + seed),
      );
      expect(shares).toEqual(
        sharesSplit(1n, ["b", "a"], [...s].reverse(), "tie-" + seed),
      );
      percentageWinners.add(percent.find((x) => x.amount === 1n)!.memberId);
      shareWinners.add(shares.find((x) => x.amount === 1n)!.memberId);
      conserved(1n, percent);
      conserved(1n, shares);
    }
    expect(percentageWinners.size).toBe(2);
    expect(shareWinners.size).toBe(2);
  });
  it("allocates 2:1:1 exactly", () => {
    const result = sharesSplit(
      10000n,
      ids,
      ids.map((memberId, i) => ({ memberId, weight: i === 0 ? 2n : 1n })),
      "expense",
    );
    expect(result.map((a) => a.amount)).toEqual([5000n, 2500n, 2500n]);
    conserved(10000n, result);
  });
  it("handles unequal large weights and BigInt products exactly", () => {
    const result = sharesSplit(
      100000000n,
      ids,
      [
        { memberId: "a", weight: 1000000n },
        { memberId: "b", weight: 999999n },
        { memberId: "c", weight: 1n },
      ],
      "large",
    );
    expect(result.map((a) => a.amount)).toEqual([50000000n, 49999950n, 50n]);
    conserved(100000000n, result);
  });
  it.each([0n, -1n])("rejects weight %s", (weight) => {
    expect(() =>
      sharesSplit(100n, ["a"], [{ memberId: "a", weight }], "expense"),
    ).toThrow(/positive/);
  });
  it("rejects decimal weights at input and runtime boundaries", () => {
    expect(() => parseWeight("1.5")).toThrow();
    expect(() =>
      sharesSplit(
        100n,
        ["a"],
        [{ memberId: "a", weight: 1.5 as unknown as bigint }],
        "expense",
      ),
    ).toThrow();
  });
});
describe("invalid money, members and transport", () => {
  it.each([
    "-1",
    "NaN",
    "Infinity",
    "1e2",
    "1.001",
    ".01",
    " 1",
    "1000000.01",
    "",
  ])("rejects invalid monetary input %s", (value) =>
    expect(() => parsePoisha(value)).toThrow(),
  );
  it.each([
    0n,
    -1n,
    100000001n,
    1.5 as unknown as bigint,
    Number.MAX_SAFE_INTEGER as unknown as bigint,
  ])("rejects invalid expense total %s", (total) =>
    expect(() => equalSplit(total, ids, "expense")).toThrow(),
  );
  it.each([
    { members: [] },
    { members: ["a", "a"] },
    { members: ["a", ""] },
    { members: ["a", "invalid id"] },
    { members: Array.from({ length: 101 }, (_, i) => "u" + i) },
  ])("rejects invalid participants $members", ({ members }) =>
    expect(() => equalSplit(100n, members, "expense")).toThrow(),
  );
  it("rejects duplicate split inputs", () => {
    expect(() =>
      exactSplit(
        100n,
        ["a", "b"],
        [
          { memberId: "a", amount: 50n },
          { memberId: "a", amount: 50n },
        ],
      ),
    ).toThrow();
  });
  it("parses decimal strings and formats values beyond Number precision without coercion", () => {
    expect(parsePoisha("100.01")).toBe(10001n);
    expect(parsePoisha("0.01")).toBe(1n);
    expect(poishaToDecimal(900719925474099312n)).toBe("9007199254740993.12");
    expect(formatPoisha("900719925474099312")).toContain(".12");
    expect(() => formatPoisha("1.1")).toThrow();
  });
  it("does not mutate inputs and rejects a missing seed", () => {
    const members = Object.freeze([...ids]);
    expect(() => equalSplit(100n, members, "")).toThrow();
    equalSplit(100n, members, "expense");
    expect(members).toEqual(ids);
  });
  it("conserves every poisha across 2000 deterministic generated cases for all four methods", () => {
    let state = 47;
    const random = () =>
      (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
    for (let i = 0; i < 2000; i++) {
      const total = BigInt((random() % 100000000) + 1);
      const members = Array.from(
        { length: (random() % 20) + 1 },
        (_, n) => "u" + n,
      );
      const equal = equalSplit(total, members, "e" + i);
      conserved(total, equal);
      conserved(total, exactSplit(total, members, equal));
      conserved(
        total,
        sharesSplit(
          total,
          members,
          members.map((memberId) => ({
            memberId,
            weight: BigInt((random() % 1000000) + 1),
          })),
          "e" + i,
        ),
      );
      const bp = random() % 10001;
      conserved(
        total,
        percentageSplit(
          total,
          ["x", "y"],
          [
            { memberId: "x", basisPoints: bp },
            { memberId: "y", basisPoints: 10000 - bp },
          ],
          "e" + i,
        ),
      );
    }
  });
});
