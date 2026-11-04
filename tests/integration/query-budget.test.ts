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
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createBalanceService } from "@/features/balances/service";
import type { ExpenseData } from "@/features/expenses/schema";
import { assertTestDatabase, databaseIdentity } from "../test-database";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100";
const run = randomUUID();
const accounts: { id: string; cookie: string }[] = [];
const groups: string[] = [];
let owner: Client;
let ga: GroupService, gb: GroupService, gc: GroupService;
let a: ExpenseService;
let groupId: string;
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
describe("quality review query budgets on isolated PostgreSQL", () => {
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
          name: `Quality ${label} ${run}`,
          email: `quality-${label}-${run}@example.test`,
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
    a = createExpenseService(prisma, resolve(accounts[0].cookie));
  });
  beforeEach(async () => {
    groupId = (await ga.create({ name: `Quality group ${run}` })).id;
    groups.push(groupId);
    groups.push((await gc.create({ name: `Quality private ${run}` })).id);
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

  it("expense lists and cross-group overviews batch relations instead of issuing one query per record", async () => {
    const adapter = new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL!,
      max: 2,
      options: "-c timezone=UTC",
    });
    const measured = new PrismaClient({
      adapter,
      log: [{ level: "query", emit: "event" }],
    });
    let selects = 0;
    measured.$on("query", (event) => {
      if (/^SELECT\b/i.test(event.query)) selects++;
    });
    const reader = createExpenseService(measured, resolve(accounts[0].cookie));
    const overview = createBalanceService(
      measured,
      resolve(accounts[0].cookie),
    );
    async function measure<T>(operation: () => Promise<T>) {
      selects = 0;
      const data = await operation();
      return { data, selects };
    }
    try {
      await a.create(input());
      const oneList = await measure(() => reader.list({ groupId }));
      const oneOverview = await measure(() => overview.overview());
      for (let i = 0; i < 24; i++) await a.create(input());
      for (let i = 0; i < 7; i++) {
        const id = (await ga.create({ name: `Quality batching ${run} ${i}` }))
          .id;
        groups.push(id);
        await a.create(
          input({
            groupId: id,
            participants: [{ memberId: accounts[0].id, value: "" }],
          }),
        );
      }
      const manyList = await measure(() => reader.list({ groupId }));
      const manyOverview = await measure(() => overview.overview());
      expect(oneList.data.items).toHaveLength(1);
      expect(manyList.data.items).toHaveLength(25);
      expect(manyOverview.data.groups.length).toBe(
        oneOverview.data.groups.length + 7,
      );
      expect(manyList.selects).toBe(oneList.selects);
      expect(manyOverview.selects).toBe(oneOverview.selects);
      expect(manyList.selects).toBeGreaterThan(0);
      expect(manyOverview.selects).toBeGreaterThan(0);
      expect(manyOverview.data.zeroSumVerified).toBe(true);
      console.info(
        "QUERY_BUDGET",
        JSON.stringify({
          expenseList: { one: oneList.selects, twentyFive: manyList.selects },
          balanceOverview: {
            oneGroup: oneOverview.selects,
            eightGroups: manyOverview.selects,
          },
          excludes: "auth queries use the separate session client",
        }),
      );
    } finally {
      await measured.$disconnect();
    }
  });
});
