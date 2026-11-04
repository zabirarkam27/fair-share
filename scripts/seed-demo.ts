import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { databaseIdentity } from "../tests/test-database";
import type { ExpenseData } from "../src/features/expenses/schema";

// Local fixture provisioning only, never a web endpoint or a custom auth system.
config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
const base = process.env.BETTER_AUTH_URL;
if (!process.argv.includes("--local") || process.env.NODE_ENV === "production")
  throw new Error(
    "Demo seeding requires --local in a non-production environment.",
  );
if (!url || !base)
  throw new Error("Configure local DATABASE_URL and BETTER_AUTH_URL first.");
const target = new URL(url),
  origin = new URL(base);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "55432" ||
  target.pathname !== "/fairshare_phase1" ||
  !["127.0.0.1", "localhost"].includes(origin.hostname) ||
  origin.protocol !== "http:" ||
  origin.port !== "3000" ||
  origin.pathname !== "/" ||
  [process.env.TEST_DATABASE_URL, process.env.PRODUCTION_DATABASE_URL].some(
    (other) => other && databaseIdentity(other) === databaseIdentity(url),
  )
)
  throw new Error(
    "Refusing demo seed outside the documented local development database/origin.",
  );

type DemoAccount = {
  name: string;
  email: string;
  password: string;
  id?: string;
};
type Manifest = {
  version: 1;
  database: string;
  origin: string;
  accounts: DemoAccount[];
  groups: Record<string, string>;
  keys: Record<string, string>;
  expenses: Record<string, string>;
  steps: Record<string, boolean>;
};
mkdirSync(".local", { recursive: true });
const path = ".local/demo-credentials.json";
const suffix = randomBytes(6).toString("hex");
const manifest: Manifest = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : {
      version: 1,
      database: databaseIdentity(url),
      origin: origin.origin,
      accounts: ["Ayesha", "Rafi", "Nusrat", "Hasan"].map((name) => ({
        name: `${name} Demo`,
        email: `fairshare-demo-${name.toLowerCase()}-${suffix}@example.test`,
        password: randomBytes(24).toString("base64url"),
      })),
      groups: {},
      keys: {},
      expenses: {},
      steps: {},
    };
if (
  manifest.version !== 1 ||
  manifest.database !== databaseIdentity(url) ||
  manifest.origin !== origin.origin ||
  manifest.accounts.length !== 4 ||
  manifest.accounts.some(
    (a) => !/^fairshare-demo-[a-z]+-[a-f0-9]{12}@example\.test$/.test(a.email),
  )
)
  throw new Error("Existing demo manifest does not match this local workflow.");
const save = () =>
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
save();
const { auth } = await import("../src/lib/auth/server");
const { prisma } = await import("../src/lib/db/prisma");
const { createGroupService } = await import("../src/features/groups/service");
const { createExpenseService } =
  await import("../src/features/expenses/service");
const { createBalanceService } =
  await import("../src/features/balances/service");
const { createSettlementService } =
  await import("../src/features/settlements/service");
const sessions: Headers[] = [];
try {
  for (const account of manifest.accounts) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });
    if (existing && (!account.id || existing.id !== account.id))
      throw new Error(
        "Demo email exists outside the recorded seed; no account was overwritten.",
      );
    const body = {
      name: account.name,
      email: account.email,
      password: account.password,
    };
    const response = existing
      ? await auth.api.signInEmail({
          asResponse: true,
          headers: new Headers({ Origin: base }),
          body: { email: body.email, password: body.password },
        })
      : await auth.api.signUpEmail({
          asResponse: true,
          headers: new Headers({ Origin: base }),
          body,
        });
    if (!response.ok)
      throw new Error(
        "Better Auth rejected a demo login/signup; no credential was changed.",
      );
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const headers = new Headers({ Origin: base, Cookie: cookie });
    const session = await auth.api.getSession({ headers });
    if (!session || session.user.email !== account.email)
      throw new Error("Demo session verification failed.");
    account.id = session.user.id;
    sessions.push(headers);
    save();
  }
  const resolveSession = (index: number) => () =>
    auth.api.getSession({ headers: sessions[index] });
  const groups = manifest.accounts.map((_, index) =>
    createGroupService(prisma, resolveSession(index)),
  );
  const expenses = createExpenseService(prisma, resolveSession(0));
  const balances = createBalanceService(prisma, resolveSession(0));
  const settlements = createSettlementService(prisma, resolveSession(0));
  async function group(key: string, name: string) {
    if (!manifest.groups[key]) {
      manifest.groups[key] = (
        await groups[0].create({
          name,
          description: "Fictional local demo data. No real payment was made.",
        })
      ).id;
      save();
    }
    const id = manifest.groups[key];
    const existing = await groups[0].detail({ groupId: id });
    if (existing.name !== name || existing.myRole !== "ADMIN")
      throw new Error("Demo group identity changed; refusing seed writes.");
    if (!manifest.steps[`members-${key}`]) {
      const invitation = await groups[0].issueInvite({ groupId: id });
      for (const member of groups.slice(1))
        await member.join({ token: invitation.token });
      await groups[0].revokeInvite({ groupId: id });
      manifest.steps[`members-${key}`] = true;
      save();
    }
    return id;
  }
  function requestKey(key: string) {
    if (!manifest.keys[key]) {
      manifest.keys[key] = randomUUID();
      save();
    }
    return manifest.keys[key];
  }
  async function expense(key: string, data: ExpenseData) {
    if (!manifest.expenses[key]) {
      const saved = await expenses.create({
        ...data,
        requestKey: requestKey(key),
      });
      manifest.expenses[key] = saved.id;
      save();
    }
    return expenses.detail({
      groupId: data.groupId,
      expenseId: manifest.expenses[key],
    });
  }
  const ids = manifest.accounts.map((account) => account.id!);
  const trip = await group("trip", "Cox's Bazar - Demo");
  const common = { groupId: trip, date: "2026-11-04", paidById: ids[0] };
  await expense("hotel", {
    ...common,
    description: "Hotel - equal split",
    amount: "4000.01",
    splitType: "EQUAL",
    participants: ids.map((memberId) => ({ memberId, value: "" })),
  });
  const dinner = await expense("dinner", {
    ...common,
    paidById: ids[1],
    description: "Dinner - exact amounts",
    amount: "1000",
    splitType: "EXACT",
    participants: ids
      .slice(0, 3)
      .map((memberId, i) => ({ memberId, value: ["500", "300", "200"][i] })),
  });
  if (!manifest.steps["dinner-history"]) {
    await expenses.edit({
      ...common,
      expenseId: dinner.id,
      version: dinner.version,
      paidById: ids[1],
      description: "Dinner - corrected receipt",
      amount: "1100",
      splitType: "EXACT",
      participants: ids
        .slice(0, 3)
        .map((memberId, i) => ({ memberId, value: ["550", "330", "220"][i] })),
    });
    manifest.steps["dinner-history"] = true;
    save();
  }
  await expense("ride", {
    ...common,
    paidById: ids[2],
    description: "Ride - percentage split, payer excluded",
    amount: "999.99",
    splitType: "PERCENTAGE",
    participants: [ids[0], ids[1], ids[3]].map((memberId, i) => ({
      memberId,
      value: ["50.25", "24.75", "25"][i],
    })),
  });
  await expense("snacks", {
    ...common,
    paidById: ids[3],
    description: "Snacks - 2:1:1 shares",
    amount: "400",
    splitType: "SHARES",
    participants: [ids[0], ids[1], ids[3]].map((memberId, i) => ({
      memberId,
      value: ["2", "1", "1"][i],
    })),
  });
  async function payment(
    key: string,
    groupId: string,
    fromId: string,
    toId: string,
    amount: string,
    method: "BKASH" | "CASH" | "BANK",
  ) {
    await settlements.record({
      groupId,
      fromId,
      toId,
      amount,
      method,
      requestKey: requestKey(key),
    });
  }
  await payment("partial-cash", trip, ids[1], ids[0], "200", "CASH");
  await payment("partial-bkash", trip, ids[3], ids[0], "150", "BKASH");
  const settled = await group("settled", "Dinner - Settled Demo");
  await expense("settled-dinner", {
    groupId: settled,
    date: "2026-11-04",
    paidById: ids[2],
    description: "Dinner - fully settled example",
    amount: "1200",
    splitType: "EXACT",
    participants: [ids[1], ids[3]].map((memberId) => ({
      memberId,
      value: "600",
    })),
  });
  await payment("full-bank", settled, ids[1], ids[2], "600", "BANK");
  await payment("full-bkash", settled, ids[3], ids[2], "600", "BKASH");
  const summaries = [];
  for (const [key, groupId] of Object.entries(manifest.groups)) {
    const result = await balances.detail({ groupId });
    const plan = await settlements.suggestions({ groupId });
    if (result.groupTotalPoisha !== "0" || !plan.clearsBalances)
      throw new Error("Demo financial verification failed.");
    if (
      key === "settled" &&
      result.members.some((member) => member.netPoisha !== "0")
    )
      throw new Error("Settled demo did not clear.");
    summaries.push({
      key,
      groupId,
      expenses: result.expenses.length,
      settlements: result.settlements.length,
      groupTotalPoisha: result.groupTotalPoisha,
      balances: result.members.map((m) => ({
        name: m.name,
        netPoisha: m.netPoisha,
      })),
      suggestedPayments: plan.payments.length,
    });
  }
  writeFileSync(
    ".local/demo-verification.json",
    JSON.stringify(
      { verifiedAt: new Date().toISOString(), groups: summaries },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        createdOrVerifiedAccounts: manifest.accounts.length,
        groups: summaries,
        credentialFile: path,
        origin: origin.origin,
      },
      null,
      2,
    ),
  );
} finally {
  for (const headers of sessions)
    await auth.api.signOut({ headers }).catch(() => undefined);
  await prisma.$disconnect();
}
