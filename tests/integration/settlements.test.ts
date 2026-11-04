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
} from "@/features/expenses/service";
import { createBalanceService } from "@/features/balances/service";
import { createSettlementService } from "@/features/settlements/service";
import { verifySuggestedPayments } from "@/features/settlements/engine";
import { assertTestDatabase, databaseIdentity } from "../test-database";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100",
  run = randomUUID();
const accounts: { id: string; cookie: string }[] = [],
  groups: string[] = [];
let owner: Client, groupId: string, otherId: string;
let ga: GroupService, gb: GroupService, gc: GroupService, gd: GroupService;
let expenses: ExpenseService;
let a: ReturnType<typeof createSettlementService>,
  b: typeof a,
  c: typeof a,
  d: typeof a;
let balances: ReturnType<typeof createBalanceService>;
function resolve(cookie: string) {
  return () =>
    auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
}
function input(amount = "1000", extra: Record<string, unknown> = {}) {
  return {
    groupId,
    fromId: accounts[1].id,
    toId: accounts[0].id,
    amount,
    method: "BKASH" as const,
    requestKey: randomUUID(),
    ...extra,
  };
}
async function debt(
  amount = "1000",
  paidById = accounts[0].id,
  userId = accounts[1].id,
) {
  return expenses.create({
    groupId,
    description: `Settlement expense ${run}`,
    date: "2026-11-04",
    amount,
    paidById,
    splitType: "EXACT",
    participants: [{ memberId: userId, value: amount }],
    requestKey: randomUUID(),
  });
}
async function checked() {
  const result = await balances.detail({ groupId });
  expect(result.groupTotalPoisha).toBe("0");
  expect(result.members.reduce((s, m) => s + BigInt(m.netPoisha), 0n)).toBe(0n);
  return result;
}
async function plan(service = a) {
  const before = await checked(),
    result = await service.suggestions({ groupId });
  expect(
    verifySuggestedPayments(
      before.members.map((m) => ({
        memberId: m.memberId,
        netPoisha: BigInt(m.netPoisha),
      })),
      result.payments.map((p) => ({
        ...p,
        amountPoisha: BigInt(p.amountPoisha),
      })),
    ),
  ).toBe(true);
  return result;
}
describe("settlement suggestions and recording — real sessions and PostgreSQL", () => {
  beforeAll(async () => {
    const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Unsafe settlement test database.");
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
          name: `Settlement ${label} ${run}`,
          email: `settlements-${label}-${run}@example.test`,
          password: "SettlementIntegration!2026",
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
      createGroupService(prisma, resolve(x.cookie)),
    );
    [a, b, c, d] = accounts.map((x) =>
      createSettlementService(prisma, resolve(x.cookie)),
    );
    expenses = createExpenseService(prisma, resolve(accounts[0].cookie));
    balances = createBalanceService(prisma, resolve(accounts[0].cookie));
  });
  beforeEach(async () => {
    groupId = (await ga.create({ name: `Settlement group ${run}` })).id;
    groups.push(groupId);
    otherId = (await gd.create({ name: `Other settlement ${run}` })).id;
    groups.push(otherId);
    const invite = await ga.issueInvite({ groupId });
    await gb.join({ token: invite.token });
    await gc.join({ token: invite.token });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    if (!owner) return;
    if (groups.length) {
      for (const table of [
        "activity",
        "settlements",
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
  it("one debtor and creditor: suggestions are read-only and leave balances unchanged", async () => {
    await debt();
    const before = await checked(),
      p = await plan();
    expect(p.payments).toHaveLength(1);
    expect(p.payments[0]).toMatchObject({
      fromId: accounts[1].id,
      toId: accounts[0].id,
      amountPoisha: "100000",
    });
    expect(await checked()).toEqual(before);
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(0);
    expect(
      await prisma.activity.count({
        where: { groupId, type: "SETTLEMENT_RECORDED" },
      }),
    ).toBe(0);
  });
  it("multiple debtors, one creditor", async () => {
    await debt("400");
    await debt("600", accounts[0].id, accounts[2].id);
    expect((await plan()).payments).toHaveLength(2);
  });
  it("one debtor, multiple creditors", async () => {
    await debt("600");
    await debt("400", accounts[2].id);
    expect((await plan()).payments).toHaveLength(2);
  });
  it("multiple debtors and creditors", async () => {
    const invite = await ga.issueInvite({ groupId });
    await gd.join({ token: invite.token });
    await debt("900");
    await debt("300", accounts[2].id, accounts[3].id);
    expect((await plan()).payments).toHaveLength(2);
  });
  it("exact zero balances produce no suggestions", async () => {
    expect((await plan()).payments).toEqual([]);
    await expect(b.record(input("1"))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await checked();
  });
  it("partial payment records once and recalculates the remaining obligation", async () => {
    await debt();
    const result = await b.record(input("400"));
    expect(result.groupTotalPoisha).toBe("0");
    expect(result.balances.reduce((s, m) => s + BigInt(m.netPoisha), 0n)).toBe(
      0n,
    );
    expect(
      result.balances.find((m) => m.memberId === accounts[1].id)?.netPoisha,
    ).toBe("-60000");
    expect((await plan()).payments[0].amountPoisha).toBe("60000");
  });
  it.each(["BKASH", "CASH", "BANK"])(
    "full settlement supports method %s and clears all balances",
    async (method) => {
      await debt();
      const result = await b.record(input("1000", { method }));
      expect(result.method).toBe(method);
      expect((await checked()).members.every((m) => m.netPoisha === "0")).toBe(
        true,
      );
      expect((await plan()).payments).toEqual([]);
      expect(
        await prisma.activity.count({
          where: { entityId: result.id, type: "SETTLEMENT_RECORDED" },
        }),
      ).toBe(1);
    },
  );
  it("repeated and concurrent submissions with the same request key are idempotent after full settlement", async () => {
    await debt();
    const data = input();
    const [first, second] = await Promise.all([b.record(data), b.record(data)]);
    expect(first.id).toBe(second.id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    const replay = await b.record({ ...data, amount: "1000.00" });
    expect(replay.id).toBe(first.id);
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(1);
    expect(
      await prisma.activity.count({
        where: { entityId: first.id, type: "SETTLEMENT_RECORDED" },
      }),
    ).toBe(1);
    await checked();
  });
  it("a reused key with changed amount or method conflicts", async () => {
    await debt();
    const data = input("400");
    await b.record(data);
    for (const change of [{ amount: "401" }, { method: "CASH" }])
      await expect(b.record({ ...data, ...change })).rejects.toMatchObject({
        code: "CONFLICT",
      });
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(1);
    await checked();
  });
  it("concurrent full payments with different keys cannot overpay", async () => {
    await debt();
    const results = await Promise.allSettled([
      b.record(input()),
      b.record(input()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(1);
    await checked();
  });
  it("concurrent partial payments cannot exceed remaining debt", async () => {
    await debt();
    const results = await Promise.allSettled([
      b.record(input("600")),
      b.record(input("600")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await plan()).payments[0].amountPoisha).toBe("40000");
    await checked();
  });
  it("rejects overpayment against either debtor or creditor", async () => {
    await debt("600");
    await debt("400", accounts[2].id);
    await expect(b.record(input("1000"))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      b.record(input("1000.01", { toId: accounts[2].id })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(0);
    await checked();
  });
  it("rejects zero, negative, fractional-poisha, malformed amounts and self-payments", async () => {
    await debt();
    for (const amount of ["0", "-1", "1.001", "1e2", "1000000.01"])
      await expect(b.record(input(amount))).rejects.toBeDefined();
    await expect(
      b.record(input("1", { toId: accounts[1].id })),
    ).rejects.toBeDefined();
    await checked();
  });
  it("rejects invalid and out-of-group member IDs", async () => {
    await debt();
    for (const fromId of ["", "bad id", "invented", accounts[3].id])
      await expect(a.record(input("1", { fromId }))).rejects.toBeDefined();
    await expect(
      a.record(input("1", { toId: accounts[3].id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await checked();
  });
  it("cross-group operations cannot read suggestions or record another group's members", async () => {
    await debt();
    await expect(d.suggestions({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(d.record(input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      d.record(input("1", { groupId: otherId })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      b.record(input("1", { groupId: otherId })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await checked();
  });
  it("an unrelated normal member cannot record, regardless of visible suggestions", async () => {
    await debt();
    const result = await plan(c);
    expect(result.payments.every((p) => !p.canRecord)).toBe(true);
    await expect(c.record(input())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await checked();
  });
  it("a nonadmin receiver can acknowledge a completed payment", async () => {
    await debt("1000", accounts[2].id);
    const result = await c.record(input("1000", { toId: accounts[2].id }));
    const row = await prisma.settlement.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(row.createdById).toBe(accounts[2].id);
    await checked();
  });
  it("the admin may record between two other involved members", async () => {
    await debt("1000", accounts[2].id);
    await a.record(input("1000", { toId: accounts[2].id }));
    await checked();
  });
  it("anonymous callers and forged actor/role fields fail", async () => {
    await debt();
    const anonymous = createSettlementService(prisma, resolve(""));
    await expect(anonymous.suggestions({ groupId })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(anonymous.record(input())).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    for (const change of [
      { createdById: accounts[0].id },
      { role: "ADMIN" },
      { balances: [] },
    ])
      await expect(c.record({ ...input(), ...change })).rejects.toBeDefined();
    await checked();
  });
  it("removed members cannot be newly referenced or operate on a group", async () => {
    await debt();
    await b.record(input());
    await ga.remove({ groupId, memberId: accounts[1].id });
    await expect(a.record(input("1"))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(b.suggestions({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await checked();
  });
  it("stale suggestions are revalidated after an expense edit", async () => {
    const e = await debt();
    await plan();
    await expenses.edit({
      groupId,
      expenseId: e.id,
      version: e.version,
      description: e.description,
      date: e.date,
      amount: "100",
      paidById: accounts[0].id,
      splitType: "EXACT",
      participants: [{ memberId: accounts[1].id, value: "100" }],
    });
    await expect(b.record(input())).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await plan()).payments[0].amountPoisha).toBe("10000");
    await checked();
  });
  it("an audit failure rolls back settlement insertion and balances", async () => {
    await debt();
    const before = await checked();
    await owner.query("REVOKE INSERT ON activity FROM fairshare_p1_test_app");
    try {
      await expect(b.record(input("400"))).rejects.toBeDefined();
    } finally {
      await owner.query("GRANT INSERT ON activity TO fairshare_p1_test_app");
    }
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(0);
    expect(await checked()).toEqual(before);
  });
  it("completed settlement and audit records cannot be changed or hard-deleted by runtime", async () => {
    await debt();
    const result = await b.record(input("400"));
    await expect(
      prisma.settlement.update({
        where: { id: result.id },
        data: { amount: 1n },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.settlement.delete({ where: { id: result.id } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.activity.deleteMany({ where: { entityId: result.id } }),
    ).rejects.toBeDefined();
    await checked();
  });
  it("deleted groups reject new recordings and suggestions", async () => {
    await debt();
    await checked();
    const group = await ga.detail({ groupId });
    await ga.delete({ groupId, confirmation: group.name });
    await expect(b.record(input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(a.suggestions({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("recording and member removal share the group lock and preserve settled history", async () => {
    await debt();
    const [recorded, removed] = await Promise.allSettled([
      b.record(input()),
      ga.remove({ groupId, memberId: accounts[1].id }),
    ]);
    expect(recorded.status).toBe("fulfilled");
    if (removed.status === "rejected")
      expect(removed.reason).toMatchObject({ code: "CONFLICT" });
    expect((await checked()).members.every((m) => m.netPoisha === "0")).toBe(
      true,
    );
  });
  it("large obligations generate recordable capped payments", async () => {
    await debt("1000000");
    await debt("1000000");
    await debt("0.01");
    const result = await plan();
    expect(result.algorithm).toBe("GREEDY");
    expect(result.minimumGuaranteed).toBe(false);
    expect(result.payments.map((p) => p.amountPoisha)).toEqual([
      "100000000",
      "100000000",
      "1",
    ]);
    await checked();
  });
  it("HTTP suggestions render without recording a settlement or disclosing the group to outsiders", async () => {
    await debt();
    const response = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[0].cookie },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Payment suggestions");
    expect(html).toContain("Record a payment");
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(0);
    const outsider = await fetch(base + `/dashboard/groups/${groupId}`, {
      headers: { Cookie: accounts[3].cookie },
    });
    expect(await outsider.text()).not.toContain(`Settlement expense ${run}`);
    await checked();
  });
});
