import { and, eq, desc, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import {
  groups,
  members,
  user,
  expenses,
  settlements,
  activity,
} from "./schema";
import { balances, decimalUnits, splitMoney, suggestPayments } from "./money";
import {
  expenseSchema,
  groupSchema,
  idSchema,
  settlementSchema,
} from "./validation";
import { z } from "zod";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new AppError(status, message);
};
async function membership(
  tx: Tx,
  groupId: string,
  actor: string,
  lock = false,
) {
  idSchema.parse(groupId);
  // Every writer locks the same group row before checking membership or ledger state.
  const rows = lock
    ? await tx.select().from(groups).where(eq(groups.id, groupId)).for("update")
    : await tx.select().from(groups).where(eq(groups.id, groupId));
  const [member] = await tx
    .select()
    .from(members)
    .where(
      and(
        eq(members.groupId, groupId),
        eq(members.userId, actor),
        eq(members.active, true),
      ),
    );
  if (!rows[0] || !member) return fail(404, "Group not found.");
  return { group: rows[0], member };
}
const admin = (role: string) => {
  if (role !== "admin") fail(403, "Only a group admin can do that.");
};
async function ledger(tx: Tx, id: string) {
  const people = await tx
    .select({
      userId: members.userId,
      name: user.name,
      role: members.role,
      active: members.active,
    })
    .from(members)
    .innerJoin(user, eq(user.id, members.userId))
    .where(eq(members.groupId, id));
  const bills = await tx
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, id))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  const payments = await tx
    .select()
    .from(settlements)
    .where(eq(settlements.groupId, id))
    .orderBy(desc(settlements.createdAt));
  const net = balances(
    people.map((m) => m.userId),
    bills,
    payments,
  );
  return {
    members: people,
    expenses: bills,
    settlements: payments,
    balances: net,
    suggestions: suggestPayments(net),
  };
}
async function audit(
  tx: Tx,
  groupId: string,
  actorId: string,
  action: string,
  entityId: string,
  before: unknown = null,
  after: unknown = null,
) {
  await tx
    .insert(activity)
    .values({
      id: randomUUID(),
      groupId,
      actorId,
      action,
      entityId,
      before,
      after,
    });
}
export async function overview(actor: string) {
  return db.transaction(
    async (tx) => {
      const own = await tx
        .select({
          id: groups.id,
          name: groups.name,
          description: groups.description,
          role: members.role,
        })
        .from(groups)
        .innerJoin(members, eq(groups.id, members.groupId))
        .where(and(eq(members.userId, actor), eq(members.active, true)))
        .orderBy(desc(groups.createdAt));
      if (!own.length) return { groups: [], owe: 0, owed: 0 };
      const ids = own.map((g) => g.id);
      const allMembers = await tx
        .select()
        .from(members)
        .where(inArray(members.groupId, ids));
      const allExpenses = await tx
        .select()
        .from(expenses)
        .where(inArray(expenses.groupId, ids));
      const allSettlements = await tx
        .select()
        .from(settlements)
        .where(inArray(settlements.groupId, ids));
      const result = own.map((g) => {
        const bills = allExpenses.filter((e) => e.groupId === g.id);
        const net = balances(
          allMembers.filter((m) => m.groupId === g.id).map((m) => m.userId),
          bills,
          allSettlements.filter((s) => s.groupId === g.id),
        );
        return {
          ...g,
          balance: net[actor],
          spent: bills.reduce((s, e) => s + e.amount, 0),
          memberCount: allMembers.filter((m) => m.groupId === g.id && m.active)
            .length,
        };
      });
      return {
        groups: result,
        owe: result.reduce((s, g) => s + Math.max(0, -g.balance), 0),
        owed: result.reduce((s, g) => s + Math.max(0, g.balance), 0),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function groupDetail(actor: string, id: string) {
  return db.transaction(
    async (tx) => {
      const { group, member } = await membership(tx, id, actor);
      return {
        ...group,
        myRole: member.role,
        ...(await ledger(tx, id)),
        activity: await tx
          .select()
          .from(activity)
          .where(eq(activity.groupId, id))
          .orderBy(desc(activity.createdAt))
          .limit(100),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function createGroup(actor: string, input: unknown) {
  const data = groupSchema.parse(input);
  return db.transaction(async (tx) => {
    const id = randomUUID();
    await tx
      .insert(groups)
      .values({ id, ...data, inviteToken: randomBytes(24).toString("hex") });
    await tx
      .insert(members)
      .values({ groupId: id, userId: actor, role: "admin" });
    await audit(tx, id, actor, "created group", id, null, data);
    return { id };
  });
}
export async function joinGroup(actor: string, input: unknown) {
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{48}$/) })
    .strict()
    .parse(input);
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(eq(groups.inviteToken, token))
      .for("update");
    if (!group)
      return fail(404, "This invitation is invalid or has been replaced.");
    const people = await tx
      .select()
      .from(members)
      .where(eq(members.groupId, group.id));
    const existing = people.find((m) => m.userId === actor);
    if (existing?.active) return { id: group.id };
    if (people.filter((m) => m.active).length >= 100)
      fail(409, "This group has reached 100 active members.");
    await tx
      .insert(members)
      .values({ groupId: group.id, userId: actor, role: "member" })
      .onConflictDoUpdate({
        target: [members.groupId, members.userId],
        set: { active: true, role: "member" },
      });
    await audit(tx, group.id, actor, "joined group", actor);
    return { id: group.id };
  });
}
export async function saveExpense(
  actor: string,
  groupId: string,
  input: unknown,
  expenseId?: string,
) {
  const data = expenseSchema.parse(input);
  const amount = decimalUnits(data.amount);
  return db.transaction(async (tx) => {
    const { member } = await membership(tx, groupId, actor, true);
    const id = expenseId ? idSchema.parse(expenseId) : randomUUID();
    const [old] = expenseId
      ? await tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.id, id), eq(expenses.groupId, groupId)))
      : [];
    if (expenseId && !old) fail(404, "Expense not found.");
    if (old && old.createdBy !== actor && member.role !== "admin")
      fail(403, "Only the author or an admin can edit this expense.");
    if (old && data.version !== old.version)
      fail(409, "This expense changed. Refresh before editing again.");
    const active = await tx
      .select()
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.active, true)));
    const allowed = new Set(active.map((m) => m.userId));
    if (old && (!allowed.has(old.paidBy) || old.allocations.some(a => !allowed.has(a.userId))))
      fail(409, 'This expense involves a former member. They must rejoin before it can be edited or deleted.');
    if (
      !allowed.has(data.paidBy) ||
      data.inputs.some((i) => !allowed.has(i.userId))
    )
      fail(
        400,
        "The payer and participants must be active members of this group.",
      );
    const allocations = splitMoney(amount, data.splitType, data.inputs, id);
    const values = {
      description: data.description,
      amount,
      date: data.date,
      paidBy: data.paidBy,
      splitType: data.splitType,
      inputs: data.inputs,
      allocations,
      version: (old?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    if (old) await tx.update(expenses).set(values).where(eq(expenses.id, id));
    else
      await tx
        .insert(expenses)
        .values({ id, groupId, createdBy: actor, ...values });
    await audit(
      tx,
      groupId,
      actor,
      old ? "edited expense" : "added expense",
      id,
      old ?? null,
      { id, groupId, createdBy: old?.createdBy ?? actor, ...values },
    );
    return { id };
  });
}
export async function deleteExpense(
  actor: string,
  groupId: string,
  id: string,
  input: unknown,
) {
  const { version } = z
    .object({ version: z.number().int().positive() })
    .strict()
    .parse(input);
  idSchema.parse(id);
  return db.transaction(async (tx) => {
    const { member } = await membership(tx, groupId, actor, true);
    const [old] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.groupId, groupId)));
    if (!old) return fail(404, "Expense not found.");
    if (old.createdBy !== actor && member.role !== "admin")
      fail(403, "Only the author or an admin can delete this expense.");
    if (old.version !== version)
      fail(409, "This expense changed. Refresh and try again.");
    const active = await tx.select().from(members).where(and(eq(members.groupId,groupId),eq(members.active,true)));
    const allowed = new Set(active.map(m=>m.userId));
    if (!allowed.has(old.paidBy) || old.allocations.some(a=>!allowed.has(a.userId)))
      fail(409, 'This expense involves a former member. They must rejoin before it can be edited or deleted.');
    await tx.delete(expenses).where(eq(expenses.id, id));
    await audit(tx, groupId, actor, "deleted expense", id, old);
    return { ok: true };
  });
}
export async function settle(actor: string, groupId: string, input: unknown) {
  const data = settlementSchema.parse(input);
  const amount = decimalUnits(data.amount);
  if (amount <= 0 || data.fromId === data.toId)
    fail(400, "Choose two different members and a positive amount.");
  return db.transaction(async (tx) => {
    const { member } = await membership(tx, groupId, actor, true);
    if (data.fromId !== actor && data.toId !== actor && member.role !== "admin")
      fail(403, "You can only record a payment involving yourself.");
    const existing = await tx
      .select()
      .from(settlements)
      .where(eq(settlements.id, data.requestId));
    if (existing[0]) {
      const e = existing[0];
      if (
        e.groupId === groupId &&
        e.createdBy === actor &&
        e.fromId === data.fromId &&
        e.toId === data.toId &&
        e.amount === amount &&
        e.method === data.method
      )
        return { id: e.id };
      return fail(409, "Payment request ID already used.");
    }
    const l = await ledger(tx, groupId);
    if (
      !l.members.some((m) => m.active && m.userId === data.fromId) ||
      !l.members.some((m) => m.active && m.userId === data.toId)
    )
      fail(400, "Select active members.");
    if (
      !(l.balances[data.fromId] < 0) ||
      !(l.balances[data.toId] > 0) ||
      amount > Math.min(-l.balances[data.fromId], l.balances[data.toId])
    )
      fail(
        409,
        "Payment exceeds the current debt or credit. Refresh your balances.",
      );
    await tx
      .insert(settlements)
      .values({
        id: data.requestId,
        groupId,
        fromId: data.fromId,
        toId: data.toId,
        amount,
        method: data.method,
        createdBy: actor,
      });
    await audit(
      tx,
      groupId,
      actor,
      "recorded settlement",
      data.requestId,
      null,
      { ...data, amount },
    );
    return { id: data.requestId };
  });
}
export async function removeMember(
  actor: string,
  groupId: string,
  target: string,
) {
  idSchema.parse(target);
  return db.transaction(async (tx) => {
    const { member } = await membership(tx, groupId, actor, true);
    if (actor !== target) admin(member.role);
    const l = await ledger(tx, groupId);
    const person = l.members.find((m) => m.userId === target && m.active);
    if (!person) fail(404, "Member not found.");
    if (person?.role === "admin")
      fail(409, "The group admin cannot leave; delete the group instead.");
    if (l.balances[target] !== 0)
      fail(409, "Settle this member’s balance before removing them.");
    await tx
      .update(members)
      .set({ active: false })
      .where(and(eq(members.groupId, groupId), eq(members.userId, target)));
    await audit(
      tx,
      groupId,
      actor,
      actor === target ? "left group" : "removed member",
      target,
    );
    return { ok: true };
  });
}
export async function deleteGroup(
  actor: string,
  groupId: string,
  input: unknown,
) {
  const { name } = z.object({ name: z.string() }).strict().parse(input);
  return db.transaction(async (tx) => {
    const { member, group } = await membership(tx, groupId, actor, true);
    admin(member.role);
    if (name !== group.name)
      fail(400, "Type the exact group name to confirm deletion.");
    await tx.delete(groups).where(eq(groups.id, groupId));
    return { ok: true };
  });
}
export async function rotateInvite(actor: string, groupId: string) {
  return db.transaction(async (tx) => {
    const { member } = await membership(tx, groupId, actor, true);
    admin(member.role);
    const inviteToken = randomBytes(24).toString("hex");
    await tx.update(groups).set({ inviteToken }).where(eq(groups.id, groupId));
    await audit(tx, groupId, actor, "replaced invite link", groupId);
    return { inviteToken };
  });
}
