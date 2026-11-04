import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balances,
  decimalUnits,
  splitMoney,
  suggestPayments,
} from "../src/lib/money";
import { expenseSchema } from "../src/lib/validation";
const input = (...values: string[]) =>
  values.map((value, i) => ({ userId: "u" + i, value }));
test("decimal parser never rounds floating point input", () => {
  assert.equal(decimalUnits("100.01"), 10001);
  assert.equal(decimalUnits("0.29"), 29);
  for (const value of [
    "-1",
    "1e2",
    "NaN",
    "1.001",
    "Infinity",
    " 2",
    "1000001",
    "",
  ])
    assert.throws(() => decimalUnits(value));
});
test("100 taka / 3 conserves every poisha", () => {
  const a = splitMoney(10000, "equal", input("", "", ""), "expense-a");
  assert.deepEqual(a.map((i) => i.amount).sort(), [3333, 3333, 3334]);
  assert.deepEqual(
    a,
    splitMoney(10000, "equal", input("", "", ""), "expense-a"),
  );
});
test("remainder tie priority varies by stable expense ID and not request order", () => {
  const selected = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const a = splitMoney(1, "equal", input("", "", ""), "expense-" + i);
    selected.add(a.find((v) => v.amount === 1)!.userId);
    assert.deepEqual(
      a,
      splitMoney(1, "equal", input("", "", "").reverse(), "expense-" + i),
    );
  }
  assert.equal(selected.size, 3);
});
test("weighted splits use largest remainders and BigInt products", () => {
  assert.deepEqual(
    splitMoney(10000, "percentage", input("50", "30", "20"), "x").map(
      (i) => i.amount,
    ),
    [5000, 3000, 2000],
  );
  assert.deepEqual(
    splitMoney(10000, "shares", input("2", "1", "1"), "x").map((i) => i.amount),
    [5000, 2500, 2500],
  );
  assert.equal(
    splitMoney(100000000, "shares", input("10000", "9999.99"), "x").reduce(
      (s, a) => s + a.amount,
      0,
    ),
    100000000,
  );
});
test("reject mismatched exact or percentage totals, duplicate IDs and zero shares", () => {
  assert.throws(() => splitMoney(100, "exact", input(".50", "0.49"), "x"));
  assert.throws(() => splitMoney(100, "exact", input("0.50", "0.49"), "x"));
  assert.throws(() => splitMoney(100, "percentage", input("50", "49.99"), "x"));
  assert.throws(() => splitMoney(100, "shares", input("0", "1"), "x"));
  assert.throws(() =>
    splitMoney(
      100,
      "equal",
      [
        { userId: "x", value: "" },
        { userId: "x", value: "" },
      ],
      "x",
    ),
  );
  assert.throws(() => splitMoney(0, "equal", input(""), "x"));
});
test("exact includes zero amounts and exact conservation", () => {
  assert.deepEqual(
    splitMoney(100000, "exact", input("500", "300", "200"), "x").map(
      (a) => a.amount,
    ),
    [50000, 30000, 20000],
  );
  assert.equal(splitMoney(100, "exact", input("0", "1"), "x")[0].amount, 0);
});
test("4000 generated equal, percentage and shares splits conserve money", () => {
  let state = 421;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let n = 0; n < 4000; n++) {
    const total = (rand() % 100000000) + 1;
    const count = (rand() % 30) + 1;
    const entries = Array.from({ length: count }, (_, i) => ({
      userId: String(i),
      value: String((rand() % 100) + 1),
    }));
    for (const type of ["equal", "shares"] as const) {
      const a = splitMoney(total, type, entries, String(n));
      assert.equal(
        a.reduce((s, p) => s + p.amount, 0),
        total,
      );
      assert.ok(a.every((p) => Number.isInteger(p.amount) && p.amount >= 0));
    }
    const pct = rand() % 10001;
    assert.equal(
      splitMoney(
        total,
        "percentage",
        input((pct / 100).toFixed(2), ((10000 - pct) / 100).toFixed(2)),
        String(n),
      ).reduce((s, a) => s + a.amount, 0),
      total,
    );
  }
});
test("ledger includes payer outside participants and excludes uninvolved members", () => {
  const net = balances(
    ["a", "b", "c"],
    [
      {
        paidBy: "a",
        amount: 10000,
        allocations: [{ userId: "b", amount: 10000 }],
      },
    ],
    [],
  );
  assert.deepEqual(net, { a: 10000, b: -10000, c: 0 });
  assert.deepEqual(
    balances(
      ["a", "b"],
      [
        {
          paidBy: "a",
          amount: 10000,
          allocations: [{ userId: "b", amount: 10000 }],
        },
      ],
      [{ fromId: "b", toId: "a", amount: 10000 }],
    ),
    { a: 0, b: 0 },
  );
});
test("corrupt ledger fails closed", () => {
  assert.throws(() =>
    balances(["a"], [{ paidBy: "a", amount: 1, allocations: [] }], []),
  );
  assert.throws(() =>
    balances(
      ["a"],
      [{ paidBy: "b", amount: 1, allocations: [{ userId: "a", amount: 1 }] }],
      [],
    ),
  );
});
test("suggestions clear balances with <= n-1 payments", () => {
  for (let k = 1; k < 100; k++) {
    const net = { a: k * 31, b: -k * 11, c: -k * 29, d: k * 9 };
    const payments = suggestPayments(net);
    const cleared = balances(Object.keys(net), [], payments);
    for (const id of Object.keys(net))
      assert.equal(net[id as keyof typeof net] + cleared[id], 0);
    assert.ok(payments.length <= 3);
  }
});
test("greedy is not globally optimal: documented counterexample", () => {
  const net = { a: -8, b: -7, c: -6, x: 9, y: 8, z: 4 };
  assert.equal(suggestPayments(net).length, 5);
  const optimal = [
    { fromId: "a", toId: "y", amount: 8 },
    { fromId: "b", toId: "x", amount: 7 },
    { fromId: "c", toId: "x", amount: 2 },
    { fromId: "c", toId: "z", amount: 4 },
  ];
  const cleared = balances(Object.keys(net), [], optimal);
  for (const id of Object.keys(net))
    assert.equal(net[id as keyof typeof net] + cleared[id], 0);
});
test("real dates and strict request shape", () => {
  const value = {
    description: "Lunch",
    amount: "1",
    date: "2026-02-30",
    paidBy: "a",
    splitType: "equal",
    inputs: input(""),
  };
  assert.equal(expenseSchema.safeParse(value).success, false);
  assert.equal(
    expenseSchema.safeParse({ ...value, date: "2026-02-28" }).success,
    true,
  );
  assert.equal(
    expenseSchema.safeParse({ ...value, date: "2026-02-28", groupId: "forged" })
      .success,
    false,
  );
});
