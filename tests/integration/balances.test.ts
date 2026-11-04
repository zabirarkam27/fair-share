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
import { createBalanceService } from "@/features/balances/service";
import { BalanceInvariantError } from "@/features/balances/engine";
import { readLedgerSnapshots } from "@/features/balances/ledger";
import type { ExpenseData } from "@/features/expenses/schema";
import { assertTestDatabase, databaseIdentity } from "../test-database";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100";
const run = randomUUID(),
  groupIds: string[] = [];
const accounts: { id: string; cookie: string }[] = [];
let owner: Client, groupId: string, otherId: string;
let ga: GroupService, gb: GroupService, gc: GroupService, gd: GroupService;
let expenses: ExpenseService;
let a: ReturnType<typeof createBalanceService>, b: typeof a, d: typeof a;
function resolver(cookie: string) {
  return () =>
    auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
}
function data(
  amount = "1000.00",
  values = ["0", "1000", "0"],
  extra: Partial<ExpenseData> = {},
) {
  return {
    groupId,
    description: `Balance expense ${run}`,
    date: "2020-01-01",
    amount,
    paidById: accounts[0].id,
    splitType: "EXACT" as const,
    participants: values.map((value, i) => ({
      memberId: accounts[i].id,
      value,
    })),
    requestKey: randomUUID(),
    ...extra,
  };
}
function edit(e: ExpenseDetail, input: ReturnType<typeof data>) {
  const { requestKey: unused, ...fields } = input;
  void unused;
  return { ...fields, expenseId: e.id, version: e.version };
}
async function payment(
  amount = 40000n,
  fromId = accounts[1].id,
  toId = accounts[0].id,
) {
  const id = randomUUID();
  await owner.query(
    'INSERT INTO settlements (id,"groupId","fromId","toId","createdById",amount,method,"requestKey") VALUES ($1,$2,$3,$4,$5,$6,\'CASH\',$7)',
    [
      id,
      groupId,
      fromId,
      toId,
      accounts[0].id,
      amount.toString(),
      randomUUID(),
    ],
  );
  return id;
}
async function checked(service = a) {
  const result = await service.detail({ groupId });
  expect(result.groupTotalPoisha).toBe("0");
  expect(result.zeroSumVerified).toBe(true);
  expect(result.members.reduce((sum, m) => sum + BigInt(m.netPoisha), 0n)).toBe(
    0n,
  );
  for (const e of result.expenses)
    expect(
      e.contributions.reduce((sum, c) => sum + BigInt(c.netPoisha), 0n),
    ).toBe(0n);
  for (const s of result.settlements)
    expect(
      s.contributions.reduce((sum, c) => sum + BigInt(c.netPoisha), 0n),
    ).toBe(0n);
  expect(() => JSON.stringify(result)).not.toThrow();
  return result;
}
function nets(result: Awaited<ReturnType<typeof checked>>) {
  return accounts
    .slice(0, 3)
    .map((x) => result.members.find((m) => m.memberId === x.id)!.netPoisha);
}
describe("persisted group balances — real PostgreSQL and authenticated sessions", () => {
  beforeAll(async () => {
    const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Unsafe balance fixture DB.");
    owner = new Client({
      connectionString: process.env.TEST_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    });
    await owner.connect();
    for (const label of ["A", "B", "C", "D"]) {
      const response = await auth.api.signUpEmail({
        asResponse: true,
        headers: new Headers({ Origin: base }),
        body: {
          name: `Balance ${label} ${run}`,
          email: `balances-${label}-${run}@example.test`,
          password: "BalanceIntegration!2026",
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
    [ga, gb, gc, gd] = accounts.map((x) =>
      createGroupService(prisma, resolver(x.cookie)),
    );
    [a, b, , d] = accounts.map((x) =>
      createBalanceService(prisma, resolver(x.cookie)),
    );
    expenses = createExpenseService(prisma, resolver(accounts[0].cookie));
  });
  beforeEach(async () => {
    groupId = (await ga.create({ name: `Balance group ${run}` })).id;
    groupIds.push(groupId);
    otherId = (await gd.create({ name: `Other balance ${run}` })).id;
    groupIds.push(otherId);
    const invite = await ga.issueInvite({ groupId });
    await gb.join({ token: invite.token });
    await gc.join({ token: invite.token });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    if (!owner) return;
    if (groupIds.length) {
      for (const table of [
        "activity",
        "settlements",
        "expense_splits",
        "expenses",
        "group_members",
      ])
        await owner.query(
          `DELETE FROM ${table} WHERE "groupId"=ANY($1::uuid[])`,
          [groupIds],
        );
      await owner.query("DELETE FROM groups WHERE id=ANY($1::uuid[])", [
        groupIds,
      ]);
    }
    for (const x of accounts)
      await owner.query('DELETE FROM "user" WHERE id=$1', [x.id]);
    await owner.end();
  });
  it("scenario 1 expected outcome follows persisted A/B 2000 BDT allocations on A's 4000", async () => {
    await expenses.create(data("4000", ["2000", "2000", "0"]));
    const result = await checked();
    expect(nets(result)).toEqual(["200000", "-200000", "0"]);
    expect(result.currentUser).toEqual({
      netPoisha: "200000",
      owedByPoisha: "0",
      owedToPoisha: "200000",
    });
    expect((await checked(b)).currentUser.owedByPoisha).toBe("200000");
  });
  it("scenario 1 literal B/C shares yields A +4000, B/C -2000 BDT", async () => {
    await expenses.create(data("4000", ["0", "2000", "2000"]));
    expect(nets(await checked())).toEqual(["400000", "-200000", "-200000"]);
  });
  it("scenario 2: 1000 BDT equally uses the saved rounding recipient, not a new calculation", async () => {
    const e = await expenses.create(
      data("1000", ["", "", ""], { splitType: "EQUAL" }),
    );
    const result = await checked();
    for (const member of result.members) {
      const allocated = e.splits.find(
        (s) => s.userId === member.memberId,
      )!.amountPoisha;
      expect(BigInt(member.netPoisha)).toBe(
        (member.memberId === accounts[0].id ? 100000n : 0n) - BigInt(allocated),
      );
    }
    expect(e.splits.map((s) => s.amountPoisha).sort()).toEqual([
      "33333",
      "33333",
      "33334",
    ]);
  });
  it("scenario 2 supplied poisha expectations apply to 100 BDT", async () => {
    await expenses.create(data("100", ["33.33", "33.33", "33.34"]));
    expect(nets(await checked())).toEqual(["6667", "-3333", "-3334"]);
  });
  it("scenario 3: payer excluded from participants; A pays 2000 BDT for B", async () => {
    await expenses.create(
      data("2000", [], {
        participants: [{ memberId: accounts[1].id, value: "2000" }],
      }),
    );
    expect(nets(await checked())).toEqual(["200000", "-200000", "0"]);
  });
  it("scenario 4: a persisted B→A settlement of 400 BDT reduces a 1000 BDT obligation to 600", async () => {
    await expenses.create(data());
    const id = await payment();
    const result = await checked();
    expect(nets(result)).toEqual(["60000", "-60000", "0"]);
    expect(result.totalExpensePoisha).toBe("100000");
    expect(result.totalSettlementPoisha).toBe("40000");
    expect(result.settlements[0].settlementId).toBe(id);
    expect(
      result.members.find((m) => m.memberId === accounts[0].id),
    ).toMatchObject({
      paidPoisha: "100000",
      allocatedPoisha: "0",
      sentPoisha: "0",
      receivedPoisha: "40000",
    });
    expect(
      result.expenses[0].contributions.find(
        (c) => c.memberId === accounts[0].id,
      )?.netPoisha,
    ).toBe("100000");
  });
  it("scenario 5: editing an old expense recalculates persisted balances while retaining its settlement", async () => {
    const e = await expenses.create(data());
    await payment();
    expect(nets(await checked())).toEqual(["60000", "-60000", "0"]);
    await expenses.edit(edit(e, data("2000", ["0", "2000", "0"])));
    const updated = await checked();
    expect(nets(updated)).toEqual(["160000", "-160000", "0"]);
    expect(updated.expenses[0].version).toBe(2);
    expect(updated.settlements).toHaveLength(1);
  });
  it("soft-deleted expenses stop contributing; recorded settlements remain authoritative", async () => {
    const e = await expenses.create(data());
    await payment();
    await checked();
    await expenses.delete({ groupId, expenseId: e.id, version: e.version });
    const result = await checked();
    expect(nets(result)).toEqual(["-40000", "40000", "0"]);
    expect(result.expenses).toEqual([]);
    expect(result.settlements).toHaveLength(1);
  });
  it("empty groups show settled members and exactly zero user totals", async () => {
    const result = await checked();
    expect(nets(result)).toEqual(["0", "0", "0"]);
    expect(result.currentUser).toEqual({
      netPoisha: "0",
      owedByPoisha: "0",
      owedToPoisha: "0",
    });
  });
  it("balances include expenses beyond the 25-row UI page", async () => {
    for (let i = 0; i < 26; i++)
      await expenses.create(
        data("0.01", [], {
          participants: [{ memberId: accounts[1].id, value: "0.01" }],
        }),
      );
    expect((await expenses.list({ groupId })).items).toHaveLength(25);
    const result = await checked();
    expect(result.expenses).toHaveLength(26);
    expect(nets(result)).toEqual(["26", "-26", "0"]);
  });
  it("outsiders cannot enumerate balances; forged identities and financial values are rejected", async () => {
    await expenses.create(data());
    await checked();
    await expect(d.detail({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    for (const extra of [
      { userId: accounts[1].id },
      { expenses: [] },
      { settlements: [] },
      { netPoisha: "0" },
    ])
      await expect(a.detail({ groupId, ...extra })).rejects.toBeDefined();
    const overview = await d.overview();
    expect(overview.groups.some((g) => g.groupId === groupId)).toBe(false);
    expect(overview.zeroSumVerified).toBe(true);
    expect(overview.owedByPoisha).toBe("0");
    expect(overview.owedToPoisha).toBe("0");
  });
  it("anonymous users cannot read group balances or current-user totals", async () => {
    await checked();
    const anon = createBalanceService(prisma, resolver(""));
    await expect(anon.detail({ groupId })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(anon.overview()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
  it("cross-group dashboard obligations are summed separately rather than cancelled", async () => {
    const baseline = await a.overview();
    await expenses.create(data());
    const invite = await gd.issueInvite({ groupId: otherId });
    await ga.join({ token: invite.token });
    const otherExpenses = createExpenseService(
      prisma,
      resolver(accounts[3].cookie),
    );
    await otherExpenses.create(
      data("250", [], {
        groupId: otherId,
        paidById: accounts[3].id,
        participants: [{ memberId: accounts[0].id, value: "250" }],
      }),
    );
    await checked();
    const other = await a.detail({ groupId: otherId });
    expect(other.groupTotalPoisha).toBe("0");
    const overview = await a.overview();
    expect(overview.zeroSumVerified).toBe(true);
    expect(BigInt(overview.owedByPoisha)).toBe(
      BigInt(baseline.owedByPoisha) + 25000n,
    );
    expect(BigInt(overview.owedToPoisha)).toBe(
      BigInt(baseline.owedToPoisha) + 100000n,
    );
    expect(
      overview.groups.find((g) => g.groupId === groupId)?.owedToPoisha,
    ).toBe("100000");
    expect(
      overview.groups.find((g) => g.groupId === otherId)?.owedByPoisha,
    ).toBe("25000");
  });
  it("fully settled members can be removed; history stays zero and unsafe corrections fail", async () => {
    const e = await expenses.create(data());
    await payment(100000n);
    expect(nets(await checked())).toEqual(["0", "0", "0"]);
    await ga.remove({ groupId, memberId: accounts[1].id });
    const after = await checked();
    expect(
      after.members.find((m) => m.memberId === accounts[1].id),
    ).toMatchObject({ status: "REMOVED", netPoisha: "0" });
    await expect(b.detail({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const updated = await expenses.edit(
      edit(e, { ...data(), description: "Harmless correction" }),
    );
    await checked();
    await expect(
      expenses.edit(edit(updated, data("1001", ["0", "1001", "0"]))),
    ).rejects.toThrow(/inactive/);
    await expect(
      expenses.delete({ groupId, expenseId: e.id, version: updated.version }),
    ).rejects.toThrow(/inactive/);
    await checked();
  });
  it("offsetting expenses permit zero-balance removal; positive and negative balances block it", async () => {
    await expenses.create(data());
    await checked();
    await expect(
      ga.remove({ groupId, memberId: accounts[1].id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expenses.create(
      data("1000", ["1000", "0", "0"], { paidById: accounts[1].id }),
    );
    expect(nets(await checked())).toEqual(["0", "0", "0"]);
    await ga.remove({ groupId, memberId: accounts[1].id });
    await checked();
    await expenses.create(
      data("10", [], {
        paidById: accounts[2].id,
        participants: [{ memberId: accounts[2].id, value: "10" }],
      }),
    );
    await checked(); // self-paid, zero contribution
    await expenses.create(
      data("10", ["10", "0", "0"], {
        paidById: accounts[2].id,
        participants: [{ memberId: accounts[0].id, value: "10" }],
      }),
    );
    await checked();
    await expect(
      ga.remove({ groupId, memberId: accounts[2].id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("runtime settlement storage is read-only, with positive/nonself/group-bound SQL constraints", async () => {
    await checked();
    const id = await payment();
    await expect(
      prisma.settlement.create({
        data: {
          id: randomUUID(),
          groupId,
          fromId: accounts[1].id,
          toId: accounts[0].id,
          createdById: accounts[0].id,
          amount: 1n,
          method: "CASH",
          requestKey: randomUUID(),
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.settlement.update({ where: { id }, data: { amount: 2n } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.settlement.delete({ where: { id } }),
    ).rejects.toBeDefined();
    await expect(payment(-1n)).rejects.toBeDefined();
    await expect(
      payment(1n, accounts[0].id, accounts[0].id),
    ).rejects.toBeDefined();
    await expect(payment(1n, accounts[3].id)).rejects.toBeDefined();
    await checked();
  });
  it("corrupted saved allocations fail visibly rather than returning a false zero-sum", async () => {
    const e = await expenses.create(data());
    await checked();
    await owner.query(
      'UPDATE expense_splits SET amount=amount-1 WHERE "expenseId"=$1 AND "userId"=$2',
      [e.id, accounts[1].id],
    );
    try {
      await expect(a.detail({ groupId })).rejects.toBeInstanceOf(
        BalanceInvariantError,
      );
      const response = await fetch(base + `/dashboard/groups/${groupId}`, {
        headers: { Cookie: accounts[0].cookie },
      });
      const html = await response.text();
      expect(html).toContain("Balances unavailable");
      expect(html).not.toContain("Zero-sum verified");
    } finally {
      await owner.query(
        'UPDATE expense_splits SET amount=amount+1 WHERE "expenseId"=$1 AND "userId"=$2',
        [e.id, accounts[1].id],
      );
    }
    await checked();
  });
  it("a repeatable-read snapshot never mixes an old expense amount with newly edited allocations", async () => {
    const e = await expenses.create(data());
    await checked();
    const old = await prisma.$transaction(
      async (tx) => {
        // Establish snapshot before a separately committed edit, then collect all
        // related records. No production hook or mocked DB client is introduced.
        const initial = await tx.expense.findUniqueOrThrow({
          where: { id: e.id },
          select: { amount: true },
        });
        expect(initial.amount).toBe(100000n);
        await expenses.edit(edit(e, data("2000", ["0", "2000", "0"])));
        return (await readLedgerSnapshots(tx, [groupId])).get(groupId)!
          .calculated;
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
    expect(old.members.reduce((sum, m) => sum + m.netPoisha, 0n)).toBe(0n);
    expect(old.groupTotalPoisha).toBe(0n);
    expect(
      old.members.find((m) => m.memberId === accounts[0].id)?.netPoisha,
    ).toBe(100000n);
    expect(nets(await checked())).toEqual(["200000", "-200000", "0"]);
  });
  it("deleted groups disappear from balance reads and dashboard totals", async () => {
    await expenses.create(data());
    await checked();
    const group = await ga.detail({ groupId });
    await ga.delete({ groupId, confirmation: group.name });
    await expect(a.detail({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const overview = await a.overview();
    expect(overview.zeroSumVerified).toBe(true);
    expect(overview.groups.some((g) => g.groupId === groupId)).toBe(false);
  });
  it("protected HTTP pages render balances and prevent private breakdown disclosure", async () => {
    await expenses.create(data());
    await payment();
    await checked();
    const own = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[0].cookie },
    });
    expect(own.status).toBe(200);
    const html = await own.text();
    expect(html).toContain("Group balances");
    expect(html).toContain("Zero-sum verified");
    expect(html).toContain("600.00");
    expect(html).toContain("Expense contributions");
    const outsider = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[3].cookie },
    });
    const denied = await outsider.text();
    expect(denied).not.toContain(`Balance expense ${run}`);
    expect(denied).not.toContain(accounts[0].id);
  });
});
