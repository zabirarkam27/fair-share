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
import { createSettlementService } from "@/features/settlements/service";
import { createActivityService } from "@/features/activity/service";
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
describe("Phase 7 server-driven interface boundaries on isolated PostgreSQL", () => {
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
          name: `Interface ${label} ${run}`,
          email: `interface-${label}-${run}@example.test`,
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
    groupId = (await ga.create({ name: `Interface group ${run}` })).id;
    groups.push(groupId);
    otherId = (await gc.create({ name: `Private interface ${run}` })).id;
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

  function preview(overrides: Partial<ExpenseData> = {}) {
    const { requestKey, ...data } = input(overrides);
    return { ...data, seed: requestKey };
  }
  it.each(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const)(
    "%s preview returns serialized conserved server allocations without writing records",
    async (method) => {
      const values =
        method === "EXACT"
          ? ["60", "40"]
          : method === "PERCENTAGE"
            ? ["60.25", "39.75"]
            : method === "SHARES"
              ? ["3", "2"]
              : ["", ""];
      const count = await prisma.activity.count({ where: { groupId } });
      const result = await b.preview(
        preview({
          splitType: method,
          participants: accounts
            .slice(0, 2)
            .map((x, i) => ({ memberId: x.id, value: values[i] })),
        }),
      );
      expect(result.totalPoisha).toBe("10000");
      expect(
        result.splits.reduce((sum, s) => sum + BigInt(s.amountPoisha), 0n),
      ).toBe(10000n);
      expect(result.splits.every((s) => BigInt(s.amountPoisha) >= 0n)).toBe(
        true,
      );
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
      expect(await prisma.activity.count({ where: { groupId } })).toBe(count);
    },
  );
  it("preview authenticates and authorizes independently of rendered pages", async () => {
    await expect(c.preview(preview())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const anonymous = createExpenseService(prisma, async () => null);
    await expect(anonymous.preview(preview())).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(
      a.preview({ ...preview(), actorId: accounts[0].id }),
    ).rejects.toThrow();
    await expect(
      a.preview(preview({ paidById: accounts[2].id })),
    ).rejects.toThrow("must belong");
    await expect(
      a.preview(
        preview({ participants: [{ memberId: accounts[2].id, value: "" }] }),
      ),
    ).rejects.toThrow("must belong");
  });
  it("edit previews enforce creator/admin permission and optimistic versions", async () => {
    const e = await a.create(input());
    await expect(
      b.preview({ ...editing(e), seed: randomUUID() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const edit = editing(e, { amount: "200.01" });
    const result = await a.preview({ ...edit, seed: randomUUID() });
    const saved = await a.edit(edit);
    expect(result.splits).toEqual(
      saved.splits.map(({ userId, amountPoisha }) => ({
        userId,
        amountPoisha,
      })),
    );
    await expect(
      a.preview({ ...edit, seed: randomUUID() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([
    ["EXACT", ["10", "10"]],
    ["PERCENTAGE", ["50.001", "49.999"]],
    ["SHARES", ["0", "1"]],
  ] as const)("preview rejects invalid %s input", async (method, values) => {
    await expect(
      a.preview(
        preview({
          splitType: method,
          participants: accounts
            .slice(0, 2)
            .map((x, i) => ({ memberId: x.id, value: values[i] })),
        }),
      ),
    ).rejects.toThrow();
  });
  it("server supplies payment form eligibility for involved and uninvolved members", async () => {
    await a.create(
      input({
        splitType: "EXACT",
        participants: [{ memberId: accounts[1].id, value: "100" }],
      }),
    );
    const adminPlan = await createSettlementService(
      prisma,
      resolve(accounts[0].cookie),
    ).suggestions({ groupId });
    const memberPlan = await createSettlementService(
      prisma,
      resolve(accounts[1].cookie),
    ).suggestions({ groupId });
    for (const plan of [adminPlan, memberPlan]) {
      expect(plan.canRecord).toBe(true);
      expect(plan.recordOptions.debtors.map((m) => m.memberId)).toEqual([
        accounts[1].id,
      ]);
      expect(plan.recordOptions.creditors.map((m) => m.memberId)).toEqual([
        accounts[0].id,
      ]);
    }
    const invite = await ga.issueInvite({ groupId });
    await gc.join({ token: invite.token });
    const unrelated = await createSettlementService(
      prisma,
      resolve(accounts[2].cookie),
    ).suggestions({ groupId });
    expect(unrelated.canRecord).toBe(false);
    expect(unrelated.recordOptions).toEqual({ debtors: [], creditors: [] });
    expect(unrelated.payments.every((p) => !p.canRecord)).toBe(true);
  });
  it("recent activity includes only active memberships and hides removed/deleted groups", async () => {
    const forA = createActivityService(prisma, resolve(accounts[0].cookie));
    const forB = createActivityService(prisma, resolve(accounts[1].cookie));
    const recent = await forA.recent();
    expect(recent.some((row) => row.groupId === groupId)).toBe(true);
    expect(recent.some((row) => row.groupId === otherId)).toBe(false);
    expect(recent.length).toBeLessThanOrEqual(8);
    expect(JSON.stringify(recent)).not.toMatch(
      /email|before|after|token|fingerprint/,
    );
    await ga.remove({ groupId, memberId: accounts[1].id });
    expect((await forB.recent()).some((row) => row.groupId === groupId)).toBe(
      false,
    );
    const group = await ga.detail({ groupId });
    await ga.delete({ groupId, confirmation: group.name });
    expect((await forA.recent()).some((row) => row.groupId === groupId)).toBe(
      false,
    );
    await expect(
      createActivityService(prisma, async () => null).recent(),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("every focused group screen renders for members and rejects private-group enumeration", async () => {
    const e = await a.create(
      input({ description: `Interface private expense ${run}` }),
    );
    const basePath = `/dashboard/groups/${groupId}`;
    for (const suffix of [
      "",
      "/expenses",
      "/expenses/new",
      `/expenses/${e.id}`,
      "/balances",
      "/settlements",
      "/settlements/history",
      "/activity",
      "/settings",
    ]) {
      const own = await fetch(base + basePath + suffix, {
        headers: { Cookie: accounts[0].cookie },
      });
      expect(own.status, suffix).toBe(200);
      const html = await own.text();
      expect(html, suffix).toContain('aria-label="Group"');
      const outsider = await fetch(base + basePath + suffix, {
        headers: { Cookie: accounts[2].cookie },
      });
      // Next.js can commit streaming headers before notFound() resolves.
      // Both forms must render the unavailable boundary and disclose no data.
      expect([200, 404], suffix).toContain(outsider.status);
      const denied = await outsider.text();
      if (outsider.status === 200)
        expect(denied).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
      expect(denied, suffix).not.toContain(e.description);
      expect(denied, suffix).not.toContain(`Interface group ${run}`);
      const anonymous = await fetch(base + basePath + suffix, {
        redirect: "manual",
      });
      expect([303, 307], suffix).toContain(anonymous.status);
      expect(anonymous.headers.get("location")).toContain("/login");
    }
  });
  it("edit routes recheck manage permission and expense-to-group binding", async () => {
    const e = await a.create(input());
    const path = `/dashboard/groups/${groupId}/expenses/${e.id}/edit`;
    expect(
      (await fetch(base + path, { headers: { Cookie: accounts[0].cookie } }))
        .status,
    ).toBe(200);
    for (const [url, cookie] of [
      [base + path, accounts[1].cookie],
      [
        base + `/dashboard/groups/${otherId}/expenses/${e.id}`,
        accounts[2].cookie,
      ],
    ]) {
      const response = await fetch(url, { headers: { Cookie: cookie } });
      expect([200, 404]).toContain(response.status);
      const html = await response.text();
      if (response.status === 200)
        expect(html).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
      expect(html).not.toContain('id="expense-description"');
      expect(html).not.toContain(e.description);
      expect(html).not.toContain(e.amountPoisha);
    }
  });
  it("dashboard uses authorized group balances and activity, and join entry is protected", async () => {
    await a.create(input({ description: `Dashboard expense ${run}` }));
    const dashboard = await fetch(base + "/dashboard", {
      headers: { Cookie: accounts[0].cookie },
    });
    expect(dashboard.status).toBe(200);
    const html = await dashboard.text();
    expect(html).toContain("Recent activity");
    expect(html).toContain("Your group balances");
    expect(html).toContain("50.00");
    expect(html).toContain(`Interface group ${run}`);
    expect(html).not.toContain(`Private interface ${run}`);
    expect(
      (
        await fetch(base + "/dashboard/join", {
          headers: { Cookie: accounts[0].cookie },
        })
      ).status,
    ).toBe(200);
    const anonymous = await fetch(base + "/dashboard/join", {
      redirect: "manual",
    });
    expect([303, 307]).toContain(anonymous.status);
  });
});
