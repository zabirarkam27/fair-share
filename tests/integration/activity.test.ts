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
  type ExpenseDetail,
  type ExpenseService,
} from "@/features/expenses/service";
import { createSettlementService } from "@/features/settlements/service";
import { createActivityService } from "@/features/activity/service";
import { writeActivity } from "@/features/activity/audit";
import { assertTestDatabase, databaseIdentity } from "../test-database";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100",
  run = randomUUID();
const accounts: { id: string; name: string; email: string; cookie: string }[] =
    [],
  groups: string[] = [];
let owner: Client, groupId: string, otherId: string;
let ga: GroupService, gb: GroupService, gc: GroupService, gd: GroupService;
let a: ReturnType<typeof createActivityService>, b: typeof a, d: typeof a;
let expenses: ExpenseService,
  payments: ReturnType<typeof createSettlementService>;
function resolver(cookie: string) {
  return () =>
    auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
}
function expenseData() {
  return {
    groupId,
    description: `Audit dinner ${run}`,
    amount: "100",
    date: "2026-11-04",
    paidById: accounts[0].id,
    splitType: "EQUAL" as const,
    participants: accounts
      .slice(0, 2)
      .map((x) => ({ memberId: x.id, value: "" })),
    requestKey: randomUUID(),
  };
}
function editing(e: ExpenseDetail) {
  const { requestKey: unused, ...data } = expenseData();
  void unused;
  return { ...data, expenseId: e.id, version: e.version };
}
function expected(e: ExpenseDetail) {
  const { canManage: unused, ...values } = e;
  void unused;
  return { ...values, deletedAt: null };
}
async function all() {
  const items: Awaited<ReturnType<typeof a.list>>["items"] = [];
  let cursor: undefined | { id: string; createdAt: string };
  do {
    const page = await a.list({ groupId, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}
describe("activity history and audit preservation on PostgreSQL", () => {
  beforeAll(async () => {
    const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Unsafe audit test DB.");
    owner = new Client({
      connectionString: process.env.TEST_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    });
    await owner.connect();
    for (const label of ["A", "B", "C", "D"]) {
      const name = `Audit ${label} ${run}`,
        email = `activity-${label}-${run}@example.test`;
      const response = await auth.api.signUpEmail({
        asResponse: true,
        headers: new Headers({ Origin: base }),
        body: { name, email, password: "ActivityIntegration!2026" },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      accounts.push({
        id: body.user.id,
        name,
        email,
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
      createActivityService(prisma, resolver(x.cookie)),
    );
    expenses = createExpenseService(prisma, resolver(accounts[0].cookie));
    payments = createSettlementService(prisma, resolver(accounts[1].cookie));
  });
  beforeEach(async () => {
    groupId = (await ga.create({ name: `Audit group ${run}` })).id;
    groups.push(groupId);
    otherId = (await gd.create({ name: `Other audit ${run}` })).id;
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
  it("tracks all seven requested actions with group/actor/resource/timestamp fields", async () => {
    const e = await expenses.create({
      ...expenseData(),
      splitType: "EXACT",
      participants: [{ memberId: accounts[1].id, value: "100" }],
    });
    const updated = await expenses.edit({
      ...editing(e),
      description: "Edited audit dinner",
      splitType: "EXACT",
      participants: [{ memberId: accounts[1].id, value: "100" }],
    });
    const settlement = await payments.record({
      groupId,
      fromId: accounts[1].id,
      toId: accounts[0].id,
      amount: "50",
      method: "CASH",
      requestKey: randomUUID(),
    });
    await expenses.delete({
      groupId,
      expenseId: e.id,
      version: updated.version,
    });
    await ga.remove({ groupId, memberId: accounts[2].id });
    const items = await all();
    for (const action of [
      "GROUP_CREATED",
      "MEMBER_JOINED",
      "MEMBER_REMOVED",
      "EXPENSE_CREATED",
      "EXPENSE_UPDATED",
      "EXPENSE_DELETED",
      "SETTLEMENT_RECORDED",
    ])
      expect(items.some((x) => x.action === action)).toBe(true);
    for (const event of items) {
      expect(event.groupId).toBe(groupId);
      expect(accounts.some((x) => x.id === event.actorId)).toBe(true);
      expect(event.actorName).toBeTruthy();
      expect(event.resourceId).toBeTruthy();
      expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
      expect(event.schemaVersion).toBe(2);
    }
    expect(items.find((x) => x.resourceId === settlement.id)?.actorId).toBe(
      accounts[1].id,
    );
    expect(items.find((x) => x.action === "EXPENSE_DELETED")?.resourceId).toBe(
      e.id,
    );
  });
  it("preserves the exact old/new chain after three expense edits and deletion", async () => {
    const v1 = await expenses.create(expenseData());
    const v2 = await expenses.edit({
      ...editing(v1),
      amount: "120",
      description: "Second version",
      date: "2026-10-01",
      paidById: accounts[1].id,
      splitType: "EXACT",
      participants: [
        { memberId: accounts[0].id, value: "20" },
        { memberId: accounts[1].id, value: "100" },
      ],
    });
    const v3 = await expenses.edit({
      ...editing(v2),
      amount: "150",
      description: "Third version",
      date: "2026-10-02",
      splitType: "PERCENTAGE",
      participants: [
        { memberId: accounts[0].id, value: "50.25" },
        { memberId: accounts[1].id, value: "49.75" },
      ],
    });
    const v4 = await expenses.edit({
      ...editing(v3),
      amount: "200",
      description: "Fourth version",
      date: "2026-10-03",
      paidById: accounts[1].id,
      splitType: "SHARES",
      participants: [
        { memberId: accounts[0].id, value: "2" },
        { memberId: accounts[1].id, value: "1" },
        { memberId: accounts[2].id, value: "1" },
      ],
    });
    const beforeDelete = (await all()).filter((x) => x.resourceId === v1.id);
    expect(beforeDelete).toHaveLength(4);
    expect(
      beforeDelete.find((x) => x.action === "EXPENSE_CREATED")?.after,
    ).toEqual(expected(v1));
    for (const [previous, next] of [
      [v1, v2],
      [v2, v3],
      [v3, v4],
    ]) {
      const event = beforeDelete.find(
        (x) =>
          x.action === "EXPENSE_UPDATED" &&
          x.after &&
          "version" in x.after &&
          x.after.version === next.version,
      );
      expect(event?.before).toEqual(expected(previous));
      expect(event?.after).toEqual(expected(next));
    }
    await expenses.delete({ groupId, expenseId: v4.id, version: v4.version });
    const afterDelete = (await all()).filter((x) => x.resourceId === v1.id);
    expect(afterDelete).toHaveLength(5);
    for (const old of beforeDelete)
      expect(afterDelete.find((x) => x.id === old.id)).toEqual(old);
    const deletion = afterDelete.find((x) => x.action === "EXPENSE_DELETED");
    expect(deletion?.before).toEqual(expected(v4));
    expect(deletion?.after).toMatchObject({
      ...expected(v4),
      version: 5,
      deletedAt: expect.any(String),
    });
    const row = await prisma.expense.findUniqueOrThrow({
      where: { id: v1.id },
    });
    expect(row.deletedAt).not.toBeNull();
  });
  it("captures membership before/after removal and joining state", async () => {
    const joined = (await all()).find(
      (x) => x.action === "MEMBER_JOINED" && x.resourceId === accounts[1].id,
    );
    expect(joined?.before).toBeNull();
    expect(joined?.after).toMatchObject({
      memberId: accounts[1].id,
      name: accounts[1].name,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: expect.any(String),
      departedAt: null,
    });
    await ga.remove({ groupId, memberId: accounts[1].id });
    const removed = (await all()).find((x) => x.action === "MEMBER_REMOVED");
    expect(removed?.before).toMatchObject({
      status: "ACTIVE",
      departedAt: null,
    });
    expect(removed?.after).toMatchObject({
      status: "REMOVED",
      departedAt: expect.any(String),
    });
  });
  it("ordinary active members can view the same sanitized group history", async () => {
    const own = await a.list({ groupId }),
      member = await b.list({ groupId });
    expect(member.items).toEqual(own.items);
  });
  it("outsiders, removed members and anonymous users cannot view history", async () => {
    await expect(d.list({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      createActivityService(prisma, resolver("")).list({ groupId }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await ga.remove({ groupId, memberId: accounts[1].id });
    await expect(b.list({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("rejects posted actor/role/metadata overrides and malformed cursor input", async () => {
    for (const extra of [
      { actorId: accounts[0].id },
      { role: "ADMIN" },
      { before: {} },
      { cursor: { createdAt: "bad", id: randomUUID() } },
    ])
      await expect(b.list({ groupId, ...extra })).rejects.toBeDefined();
  });
  it("keyset pagination is stable for equal timestamps and a newer concurrent event", async () => {
    const timestamp = "2026-11-04T00:00:00.000Z";
    for (let i = 0; i < 30; i++)
      await owner.query(
        'INSERT INTO activity (id,"groupId","actorId","actorName",type,"entityId","createdAt") VALUES ($1,$2::uuid,$3,$4,\'GROUP_CREATED\',$2::text,$5)',
        [randomUUID(), groupId, accounts[0].id, accounts[0].name, timestamp],
      );
    const expectedIds = (
      await prisma.activity.findMany({
        where: { groupId },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    ).map((x) => x.id);
    const first = await a.list({ groupId });
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).not.toBeNull();
    await ga.issueInvite({ groupId });
    const second = await a.list({ groupId, cursor: first.nextCursor! });
    const ids = [...first.items, ...second.items].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expectedIds);
    expect(second.nextCursor).toBeNull();
  });
  it("a cursor from another group cannot expose its events", async () => {
    const other = await d.list({ groupId: otherId });
    const cursor = {
      id: other.items[0].id,
      createdAt: other.items[0].createdAt,
    };
    const result = await a.list({ groupId, cursor });
    expect(result.items.every((x) => x.groupId === groupId)).toBe(true);
    expect(result.items.some((x) => x.id === other.items[0].id)).toBe(false);
  });
  it("runtime users cannot edit, delete or truncate audit rows", async () => {
    const item = (await a.list({ groupId })).items[0];
    await expect(
      prisma.activity.update({
        where: { id: item.id },
        data: { actorName: "Forged" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.activity.delete({ where: { id: item.id } }),
    ).rejects.toBeDefined();
    await expect(prisma.$executeRaw`TRUNCATE activity`).rejects.toBeDefined();
    expect(
      (await a.list({ groupId })).items.find((x) => x.id === item.id)
        ?.actorName,
    ).toBe(item.actorName);
  });
  it("writer allowlists strip credentials before persistence and reader strips legacy extras", async () => {
    await prisma.$transaction((tx) =>
      writeActivity(tx, {
        groupId,
        actor: accounts[0],
        action: "GROUP_CREATED",
        resourceId: groupId,
        after: {
          name: "Safe audit name",
          description: "Safe",
          email: "secret-email@example.test",
          token: "private-writer-token",
          inviteTokenHash: "private-hash",
        },
      }),
    );
    const raw = await prisma.activity.findMany({ where: { groupId } });
    expect(JSON.stringify(raw)).not.toContain("private-writer-token");
    expect(JSON.stringify(raw)).not.toContain("secret-email@example.test");
    const legacyId = randomUUID();
    await owner.query(
      'INSERT INTO activity (id,"groupId","actorId","actorName",type,"entityId",after) VALUES ($1,$2,$3,$4,\'MEMBER_REMOVED\',$5,$6::jsonb)',
      [
        legacyId,
        groupId,
        accounts[0].id,
        accounts[0].name,
        accounts[1].id,
        JSON.stringify({
          memberId: accounts[1].id,
          password: "private-legacy-password",
          token: "private-legacy-token",
          email: "private-legacy@example.test",
        }),
      ],
    );
    const projected = (await all()).find((x) => x.id === legacyId);
    expect(projected?.after).toEqual({ memberId: accounts[1].id });
    expect(JSON.stringify(projected)).not.toContain("private-legacy");
    const response = await fetch(
      base + `/dashboard/groups/${groupId}/activity`,
      { headers: { Cookie: accounts[0].cookie } },
    );
    expect(await response.text()).not.toContain("private-legacy");
  });
  it("new expense/settlement audit metadata has no auth, invitation, request-key or UI fields", async () => {
    const invite = await ga.issueInvite({ groupId });
    const e = await expenses.create({
      ...expenseData(),
      splitType: "EXACT",
      participants: [{ memberId: accounts[1].id, value: "100" }],
    });
    await payments.record({
      groupId,
      fromId: accounts[1].id,
      toId: accounts[0].id,
      amount: "20",
      method: "BKASH",
      requestKey: randomUUID(),
    });
    const record = await prisma.expense.findUniqueOrThrow({
        where: { id: e.id },
      }),
      group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    const rows = await prisma.activity.findMany({ where: { groupId } }),
      json = JSON.stringify(rows);
    for (const secret of [
      invite.token,
      group.inviteTokenHash!,
      record.requestKey,
      record.fingerprint,
      ...accounts.map((x) => x.email),
    ])
      expect(json).not.toContain(secret);
    expect(json).not.toContain("canManage");
    expect(json).not.toContain("password");
  });
  it("audit INSERT failure rolls back join/removal and all financial changes", async () => {
    const e = await expenses.create({
      ...expenseData(),
      splitType: "EXACT",
      participants: [{ memberId: accounts[1].id, value: "100" }],
    });
    const invite = await ga.issueInvite({ groupId });
    await owner.query("REVOKE INSERT ON activity FROM fairshare_p1_test_app");
    try {
      await expect(gd.join({ token: invite.token })).rejects.toBeDefined();
      await expect(
        ga.remove({ groupId, memberId: accounts[2].id }),
      ).rejects.toBeDefined();
      await expect(
        expenses.edit({ ...editing(e), amount: "200" }),
      ).rejects.toBeDefined();
      await expect(
        expenses.delete({ groupId, expenseId: e.id, version: e.version }),
      ).rejects.toBeDefined();
      await expect(
        payments.record({
          groupId,
          fromId: accounts[1].id,
          toId: accounts[0].id,
          amount: "20",
          method: "CASH",
          requestKey: randomUUID(),
        }),
      ).rejects.toBeDefined();
    } finally {
      await owner.query("GRANT INSERT ON activity TO fairshare_p1_test_app");
    }
    expect(
      await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: accounts[3].id } },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.groupMember.findUniqueOrThrow({
          where: { groupId_userId: { groupId, userId: accounts[2].id } },
        })
      ).status,
    ).toBe("ACTIVE");
    expect(await expenses.detail({ groupId, expenseId: e.id })).toEqual(e);
    expect(await prisma.settlement.count({ where: { groupId } })).toBe(0);
  });
  it("actor names are historical snapshots, not mutable profile lookups", async () => {
    const before = (await all()).find((x) => x.action === "GROUP_CREATED")!;
    await owner.query('UPDATE "user" SET name=$1 WHERE id=$2', [
      "Renamed audit actor",
      accounts[0].id,
    ]);
    try {
      expect((await all()).find((x) => x.id === before.id)?.actorName).toBe(
        before.actorName,
      );
    } finally {
      await owner.query('UPDATE "user" SET name=$1 WHERE id=$2', [
        accounts[0].name,
        accounts[0].id,
      ]);
    }
  });
  it("group deletion preserves activity rows but denies live history access", async () => {
    const before = (await all()).length;
    const group = await ga.detail({ groupId });
    await ga.delete({ groupId, confirmation: group.name });
    await expect(a.list({ groupId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await prisma.activity.count({ where: { groupId } })).toBe(
      before + 1,
    );
  });
  it("protected HTTP history shows old/new values after deletion without leaking to outsiders", async () => {
    const e = await expenses.create(expenseData());
    const updated = await expenses.edit({
      ...editing(e),
      description: `Preserved historical value ${run}`,
      amount: "120",
    });
    await expenses.delete({
      groupId,
      expenseId: e.id,
      version: updated.version,
    });
    const own = await fetch(base + `/dashboard/groups/${groupId}/activity`, {
      headers: { Cookie: accounts[1].cookie },
    });
    expect(own.status).toBe(200);
    const html = await own.text();
    expect(html).toContain("Activity history");
    expect(html).toContain(`Audit dinner ${run}`);
    expect(html).toContain(`Preserved historical value ${run}`);
    expect(html).toContain("Previous values");
    expect(html).toContain("New values");
    const denied = await fetch(base + `/dashboard/groups/${groupId}/activity`, {
      headers: { Cookie: accounts[3].cookie },
    });
    expect(await denied.text()).not.toContain(
      `Preserved historical value ${run}`,
    );
    const anonymous = await fetch(
      base + `/dashboard/groups/${groupId}/activity`,
      { redirect: "manual" },
    );
    expect([302, 303, 307, 308]).toContain(anonymous.status);
    expect(anonymous.headers.get("location")).toBe("/login");
  });
});
