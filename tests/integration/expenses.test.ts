import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/server";
import {
  createGroupService,
  type GroupService,
} from "@/features/groups/service";
import {
  createExpenseService,
  type ExpenseService,
  type ExpenseDetail,
} from "@/features/expenses/service";
import type { ExpenseData } from "@/features/expenses/schema";
import { assertTestDatabase, databaseIdentity } from "../test-database";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100";
const run = randomUUID();
const accounts: { id: string; cookie: string }[] = [];
const groups: string[] = [];
let owner: Client;
let ga: GroupService, gb: GroupService, gc: GroupService;
let a: ExpenseService, b: ExpenseService, c: ExpenseService;
let groupId: string, otherId: string;
function resolve(cookie: string) {
  return () =>
    auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
}
function input(overrides: Partial<ExpenseData> = {}) {
  return {
    groupId,
    description: "Shared lunch",
    amount: "100.00",
    date: "2026-11-04",
    paidById: accounts[0].id,
    splitType: "EQUAL" as const,
    participants: accounts
      .slice(0, 2)
      .map((x) => ({ memberId: x.id, value: "" })),
    requestKey: randomUUID(),
    ...overrides,
  };
}
function editing(e: ExpenseDetail, overrides: Partial<ExpenseData> = {}) {
  const { requestKey: unused, ...data } = input();
  void unused;
  return { ...data, expenseId: e.id, version: e.version, ...overrides };
}
function conserved(e: ExpenseDetail) {
  expect(e.splits.reduce((s, a) => s + BigInt(a.amountPoisha), 0n)).toBe(
    BigInt(e.amountPoisha),
  );
  expect(e.splits.every((s) => BigInt(s.amountPoisha) >= 0n)).toBe(true);
  expect(() => JSON.stringify(e)).not.toThrow();
}
describe("expense management on isolated PostgreSQL with real Better Auth sessions", () => {
  beforeAll(async () => {
    const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Unsafe test database.");
    owner = new Client({
      connectionString: process.env.TEST_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    });
    await owner.connect();
    for (const label of ["Admin", "Member", "Outsider"]) {
      const response = await auth.api.signUpEmail({
        asResponse: true,
        headers: new Headers({ Origin: base }),
        body: {
          name: `Expense ${label} ${run}`,
          email: `expense-${label}-${run}@example.test`,
          password: "ExpenseIntegration!2026",
        },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      accounts.push({
        id: body.user.id,
        cookie: response.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .join("; "),
      });
    }
    [ga, gb, gc] = accounts.map((x) =>
      createGroupService(prisma, resolve(x.cookie)),
    );
    [a, b, c] = accounts.map((x) =>
      createExpenseService(prisma, resolve(x.cookie)),
    );
  });
  beforeEach(async () => {
    groupId = (await ga.create({ name: `Expense group ${run}` })).id;
    groups.push(groupId);
    otherId = (await gc.create({ name: `Other ${run}` })).id;
    groups.push(otherId);
    const invitation = await ga.issueInvite({ groupId });
    await gb.join({ token: invitation.token });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    if (!owner) return;
    if (groups.length) {
      for (const table of [
        "activity",
        "expense_splits",
        "expenses",
        "group_members",
      ])
        await owner.query(
          `DELETE FROM ${table} WHERE "groupId"=ANY($1::uuid[])`,
          [groups],
        );
      await owner.query("DELETE FROM groups WHERE id=ANY($1::uuid[])", [
        groups,
      ]);
    }
    for (const x of accounts)
      await owner.query('DELETE FROM "user" WHERE id=$1', [x.id]);
    await owner.end();
  });
  it.each(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const)(
    "a member can create %s; saved allocations conserve poisha and serialize safely",
    async (method) => {
      const values =
        method === "EXACT"
          ? ["60.00", "40.00"]
          : method === "PERCENTAGE"
            ? ["60", "40"]
            : method === "SHARES"
              ? ["3", "2"]
              : ["", ""];
      const e = await b.create(
        input({
          splitType: method,
          participants: accounts
            .slice(0, 2)
            .map((x, i) => ({ memberId: x.id, value: values[i] })),
        }),
      );
      conserved(e);
      expect(e.createdById).toBe(accounts[1].id);
      expect(e.paidById).toBe(accounts[0].id);
      const persisted = await prisma.expense.findUniqueOrThrow({
        where: { id: e.id },
        include: { splits: true },
      });
      expect(persisted.amount).toBe(10000n);
      expect(persisted.splits).toHaveLength(2);
      expect(persisted.splits.reduce((sum, s) => sum + s.amount, 0n)).toBe(
        persisted.amount,
      );
      expect(
        persisted.splits.every((s) =>
          method === "EQUAL" ? s.inputUnits === null : s.inputUnits !== null,
        ),
      ).toBe(true);
    },
  );
  it("allows an active payer excluded from participants", async () => {
    const e = await a.create(
      input({ participants: [{ memberId: accounts[1].id, value: "" }] }),
    );
    expect(e.splits).toEqual([
      { userId: accounts[1].id, amountPoisha: "10000", inputUnits: null },
    ]);
    conserved(e);
  });
  it("rejects cross-group payer, participants, duplicate participants and invented members", async () => {
    for (const change of [
      { paidById: accounts[2].id },
      { participants: [{ memberId: accounts[2].id, value: "" }] },
      { participants: [{ memberId: "invented", value: "" }] },
      {
        participants: [
          { memberId: accounts[1].id, value: "" },
          { memberId: accounts[1].id, value: "" },
        ],
      },
    ])
      await expect(a.create(input(change))).rejects.toBeDefined();
    expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
  });
  it("rejects zero, negative, excessive, malformed and fractional-poisha amounts", async () => {
    for (const amount of ["0", "-1", "1.001", "1e2", "NaN", "1000000.01"])
      await expect(a.create(input({ amount }))).rejects.toBeDefined();
  });
  it("rejects invalid calendar dates, empty participants and missing exact values", async () => {
    for (const date of ["2026-02-30", "2026-13-01", "not-a-date"])
      await expect(a.create(input({ date }))).rejects.toBeDefined();
    await expect(a.create(input({ participants: [] }))).rejects.toBeDefined();
    await expect(
      a.create(
        input({
          splitType: "EXACT",
          participants: [
            { memberId: accounts[0].id, value: "100" },
            { memberId: accounts[1].id, value: "" },
          ],
        }),
      ),
    ).rejects.toBeDefined();
    expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
  });
  it("member removal and expense creation serialize without stranding obligations", async () => {
    const [expense, removal] = await Promise.allSettled([
      a.create(input()),
      ga.remove({ groupId, memberId: accounts[1].id }),
    ]);
    expect(
      [expense, removal].filter((x) => x.status === "fulfilled"),
    ).toHaveLength(1);
    const member = await prisma.groupMember.findUniqueOrThrow({
      where: { groupId_userId: { groupId, userId: accounts[1].id } },
    });
    expect(await prisma.expense.count({ where: { groupId } })).toBe(
      member.status === "ACTIVE" ? 1 : 0,
    );
  });
  it("rejects invalid percentage precision and mismatched exact totals without writes", async () => {
    for (const [splitType, value] of [
      ["PERCENTAGE", "50.001"],
      ["PERCENTAGE", "49.99"],
      ["EXACT", "49.99"],
      ["SHARES", "0"],
      ["SHARES", "-1"],
    ] as const)
      await expect(
        a.create(
          input({
            splitType,
            participants: accounts
              .slice(0, 2)
              .map((x) => ({ memberId: x.id, value })),
          }),
        ),
      ).rejects.toBeDefined();
    expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
  });
  it("rejects forged creator, role and precomputed allocation fields", async () => {
    for (const forged of [
      { createdById: accounts[0].id },
      { role: "ADMIN" },
      { splits: [{ userId: accounts[1].id, amount: "10000" }] },
    ])
      await expect(b.create({ ...input(), ...forged })).rejects.toBeDefined();
  });
  it("outsiders cannot enumerate, read, create, edit or delete group expenses", async () => {
    const e = await a.create(input());
    for (const operation of [
      () => c.list({ groupId }),
      () => c.detail({ groupId, expenseId: e.id }),
      () => c.create(input()),
      () => c.edit(editing(e)),
      () => c.delete({ groupId, expenseId: e.id, version: e.version }),
    ])
      await expect(operation()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("changing an expense's group ID cannot cross group boundaries", async () => {
    const e = await a.create(input());
    await expect(
      c.detail({ groupId: otherId, expenseId: e.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      c.edit(editing(e, { groupId: otherId })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      c.delete({ groupId: otherId, expenseId: e.id, version: e.version }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await c.list({ groupId: otherId })).items).toEqual([]);
  });
  it("normal members cannot edit or delete someone else's expense, including when they paid", async () => {
    const e = await a.create(input({ paidById: accounts[1].id }));
    await expect(b.edit(editing(e))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      b.delete({ groupId, expenseId: e.id, version: e.version }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await b.detail({ groupId, expenseId: e.id })).canManage).toBe(
      false,
    );
  });
  it("creators can edit and soft-delete their own expenses; splits and audit snapshots remain", async () => {
    const e = await b.create(input());
    const updated = await b.edit(
      editing(e, { amount: "99.99", description: "Updated lunch" }),
    );
    conserved(updated);
    expect(updated.version).toBe(2);
    await b.delete({ groupId, expenseId: e.id, version: 2 });
    await expect(a.detail({ groupId, expenseId: e.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const row = await prisma.expense.findUniqueOrThrow({
      where: { id: e.id },
      include: { splits: true },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.splits).toHaveLength(2);
    const events = await prisma.activity.findMany({
      where: { entityId: e.id },
    });
    expect(events.map((x) => x.type).sort()).toEqual([
      "EXPENSE_CREATED",
      "EXPENSE_DELETED",
      "EXPENSE_UPDATED",
    ]);
    expect(JSON.stringify(events)).toContain('"amountPoisha":"10000"');
    expect(JSON.stringify(events)).toContain('"amountPoisha":"9999"');
  });
  it("admins can edit and delete another member's expenses, preserving creator identity", async () => {
    const e = await b.create(input());
    const updated = await a.edit(
      editing(e, { description: "Admin corrected" }),
    );
    expect(updated.createdById).toBe(accounts[1].id);
    await a.delete({ groupId, expenseId: e.id, version: updated.version });
  });
  it("concurrent edits serialize and reject stale versions; rounding stays stable", async () => {
    const e = await a.create(input({ amount: "0.01" }));
    const results = await Promise.allSettled([
      a.edit(editing(e, { amount: "0.01", description: "First" })),
      a.edit(editing(e, { amount: "0.01", description: "Second" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    expect((await a.detail({ groupId, expenseId: e.id })).splits).toEqual(
      e.splits,
    );
    await expect(
      a.delete({ groupId, expenseId: e.id, version: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("concurrent create retries are idempotent and payload reuse conflicts", async () => {
    const data = input();
    const [one, two] = await Promise.all([b.create(data), b.create(data)]);
    expect(one.id).toBe(two.id);
    expect(await prisma.expense.count({ where: { groupId } })).toBe(1);
    expect(
      await prisma.activity.count({
        where: { entityId: one.id, type: "EXPENSE_CREATED" },
      }),
    ).toBe(1);
    await expect(b.create({ ...data, amount: "101" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("financial involvement blocks member removal; deleted expenses no longer block it", async () => {
    const e = await a.create(input());
    await expect(
      ga.remove({ groupId, memberId: accounts[1].id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await a.delete({ groupId, expenseId: e.id, version: 1 });
    await ga.remove({ groupId, memberId: accounts[1].id });
    await expect(b.list({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(a.create(input())).rejects.toBeDefined();
  });
  it("a zero-allocation former member retains history; harmless edits work but assigning debt fails", async () => {
    const data = input({
      splitType: "EXACT",
      participants: [
        { memberId: accounts[0].id, value: "100" },
        { memberId: accounts[1].id, value: "0" },
      ],
    });
    const e = await a.create(data);
    await ga.remove({ groupId, memberId: accounts[1].id });
    const updated = await a.edit(
      editing(e, {
        splitType: "EXACT",
        participants: data.participants,
        description: "Description only",
      }),
    );
    conserved(updated);
    await expect(
      a.edit(
        editing(updated, {
          splitType: "EXACT",
          participants: [
            { memberId: accounts[0].id, value: "99" },
            { memberId: accounts[1].id, value: "1" },
          ],
        }),
      ),
    ).rejects.toThrow(/inactive/);
    await a.delete({ groupId, expenseId: e.id, version: updated.version });
  });
  it("audit failure rolls back creation and editing, including split replacement", async () => {
    const e = await a.create(input());
    await owner.query("REVOKE INSERT ON activity FROM fairshare_p1_test_app");
    try {
      await expect(a.create(input())).rejects.toBeDefined();
      await expect(a.edit(editing(e, { amount: "1" }))).rejects.toBeDefined();
      await expect(
        a.delete({ groupId, expenseId: e.id, version: 1 }),
      ).rejects.toBeDefined();
    } finally {
      await owner.query("GRANT INSERT ON activity TO fairshare_p1_test_app");
    }
    expect(await prisma.expense.count({ where: { groupId } })).toBe(1);
    expect(await a.detail({ groupId, expenseId: e.id })).toEqual(e);
  });
  it("database constraints reject negative allocations and cross-group references; runtime cannot hard-delete expenses", async () => {
    const e = await a.create(input());
    await expect(
      prisma.expenseSplit.update({
        where: {
          expenseId_userId: { expenseId: e.id, userId: accounts[0].id },
        },
        data: { amount: -1n },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.expenseSplit.create({
        data: {
          groupId: otherId,
          expenseId: e.id,
          userId: accounts[2].id,
          amount: 1n,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.expense.update({
        where: { id: e.id },
        data: { paidById: accounts[2].id },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.expense.delete({ where: { id: e.id } }),
    ).rejects.toBeDefined();
  });
  it("anonymous users cannot call any expense operation", async () => {
    const anon = createExpenseService(prisma, resolve(""));
    const e = await a.create(input());
    for (const op of [
      () => anon.list({ groupId }),
      () => anon.detail({ groupId, expenseId: e.id }),
      () => anon.create(input()),
      () => anon.edit(editing(e)),
      () => anon.delete({ groupId, expenseId: e.id, version: 1 }),
    ])
      await expect(op()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("a deleted group hides its expenses and prevents further writes while preserving rows", async () => {
    const e = await a.create(input());
    const group = await ga.detail({ groupId });
    await ga.delete({ groupId, confirmation: group.name });
    await expect(a.list({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(a.edit(editing(e))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await prisma.expense.count({ where: { groupId } })).toBe(1);
  });
  it("protected expense UI renders saved splits without leaking data to an outsider", async () => {
    const e = await a.create(input({ description: `Private expense ${run}` }));
    const own = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[0].cookie },
    });
    expect(own.status).toBe(200);
    const html = await own.text();
    expect(html).toContain(e.description);
    expect(html).toContain("50.00");
    const outsider = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[2].cookie },
    });
    expect(await outsider.text()).not.toContain(e.description);
  });
});
