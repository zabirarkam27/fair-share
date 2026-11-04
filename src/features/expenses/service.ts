import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { GroupError } from "@/features/groups/service";
import {
  createExpenseSchema,
  editExpenseSchema,
  deleteExpenseSchema,
  expenseKeySchema,
  listExpenseSchema,
  type ExpenseData,
} from "./schema";
import { calculateExpense } from "./calculate";
import { MoneyError } from "./money";
import { writeActivity } from "@/features/activity/audit";

type Identity = { user: { id: string; name: string } };
type Tx = Prisma.TransactionClient;
const options = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5000,
  timeout: 10000,
};
const selection = {
  splits: { orderBy: { userId: "asc" as const } },
  payer: { select: { user: { select: { name: true } } } },
  creator: { select: { user: { select: { name: true } } } },
};
type Row = Prisma.ExpenseGetPayload<{ include: typeof selection }>;
function auditSnapshot(e: Row) {
  return {
    id: e.id,
    groupId: e.groupId,
    description: e.description,
    amountPoisha: e.amount.toString(),
    date: e.date.toISOString().slice(0, 10),
    paidById: e.paidById,
    payerName: e.payer.user.name,
    createdById: e.createdById,
    creatorName: e.creator.user.name,
    splitType: e.splitType,
    version: e.version,
    deletedAt: e.deletedAt?.toISOString() ?? null,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      amountPoisha: s.amount.toString(),
      inputUnits: s.inputUnits?.toString() ?? null,
    })),
  };
}
function dto(e: Row, actorId: string, role: string) {
  return {
    id: e.id,
    groupId: e.groupId,
    description: e.description,
    amountPoisha: e.amount.toString(),
    date: e.date.toISOString().slice(0, 10),
    paidById: e.paidById,
    payerName: e.payer.user.name,
    createdById: e.createdById,
    creatorName: e.creator.user.name,
    splitType: e.splitType,
    version: e.version,
    canManage: e.createdById === actorId || role === "ADMIN",
    splits: e.splits.map((s) => ({
      userId: s.userId,
      amountPoisha: s.amount.toString(),
      inputUnits: s.inputUnits?.toString() ?? null,
    })),
  };
}
const missing = () => new GroupError("NOT_FOUND", "Expense not found.");
export function createExpenseService(
  db: PrismaClient,
  resolveSession: () => Promise<Identity | null>,
) {
  async function actor() {
    const s = await resolveSession();
    if (!s)
      throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
    return s.user;
  }
  async function access(tx: Tx, groupId: string, userId: string, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT id FROM groups WHERE id=${groupId}::uuid FOR UPDATE`;
    const m = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });
    if (!m || m.status !== "ACTIVE" || m.group.deletedAt)
      throw new GroupError("NOT_FOUND", "Group not found.");
    return m;
  }
  async function find(tx: Tx, groupId: string, id: string) {
    const e = await tx.expense.findFirst({
      where: { id, groupId, deletedAt: null },
      include: selection,
    });
    if (!e) throw missing();
    return e;
  }
  function manage(e: Row, userId: string, role: string, version: number) {
    if (e.createdById !== userId && role !== "ADMIN")
      throw new GroupError(
        "FORBIDDEN",
        "Only the expense creator or group admin can change this expense.",
      );
    if (e.version !== version)
      throw new GroupError(
        "CONFLICT",
        "This expense changed. Refresh before trying again.",
      );
  }
  async function validate(
    tx: Tx,
    data: ExpenseData,
    seed: string,
    previous?: Row,
  ) {
    const result = calculateExpense(data, seed);
    const roster = await tx.groupMember.findMany({
      where: { groupId: data.groupId },
    });
    const byId = new Map(roster.map((m) => [m.userId, m]));
    const referenced = new Set([
      data.paidById,
      ...result.splits.map((s) => s.userId),
    ]);
    for (const id of referenced) {
      const member = byId.get(id);
      if (!member)
        throw new MoneyError(
          "Payer and participants must belong to this group.",
        );
      if (member.status !== "ACTIVE") {
        if (
          !previous ||
          (previous.paidById !== id &&
            !previous.splits.some((s) => s.userId === id))
        )
          throw new MoneyError("Select active group members.");
      }
    }
    // Preserve the financial contribution of inactive historical members. A zero
    // allocation may exist after removal; later edits must not assign them debt.
    for (const member of roster.filter((m) => m.status !== "ACTIVE")) {
      const id = member.userId;
      const before = previous
        ? (previous.paidById === id ? previous.amount : 0n) -
          (previous.splits.find((s) => s.userId === id)?.amount ?? 0n)
        : 0n;
      const after =
        (data.paidById === id ? result.total : 0n) -
        (result.splits.find((s) => s.userId === id)?.amount ?? 0n);
      if (before !== after)
        throw new MoneyError(
          "An inactive member's financial contribution cannot change.",
        );
    }
    return result;
  }
  async function audit(
    tx: Tx,
    user: Identity["user"],
    type: "EXPENSE_CREATED" | "EXPENSE_UPDATED" | "EXPENSE_DELETED",
    after: Row,
    before?: Row,
  ) {
    await writeActivity(tx, {
      groupId: after.groupId,
      actor: user,
      action: type,
      resourceId: after.id,
      after: auditSnapshot(after),
      ...(before ? { before: auditSnapshot(before) } : {}),
    });
  }
  return {
    async create(input: unknown) {
      const user = await actor();
      const data = createExpenseSchema.parse(input);
      const id = randomUUID();
      const canonical = {
        ...data,
        participants: [...data.participants].sort((a, b) =>
          a.memberId < b.memberId ? -1 : 1,
        ),
      };
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(canonical))
        .digest("hex");
      return db.$transaction(async (tx) => {
        const member = await access(tx, data.groupId, user.id, true);
        const existing = await tx.expense.findUnique({
          where: {
            groupId_createdById_requestKey: {
              groupId: data.groupId,
              createdById: user.id,
              requestKey: data.requestKey,
            },
          },
          include: selection,
        });
        if (existing) {
          if (existing.fingerprint !== fingerprint || existing.deletedAt)
            throw new GroupError(
              "CONFLICT",
              "This request was already used for a different expense.",
            );
          return dto(existing, user.id, member.role);
        }
        const calculated = await validate(tx, data, id);
        await tx.expense.create({
          data: {
            id,
            groupId: data.groupId,
            description: data.description,
            amount: calculated.total,
            date: new Date(data.date + "T00:00:00.000Z"),
            paidById: data.paidById,
            createdById: user.id,
            splitType: data.splitType,
            requestKey: data.requestKey,
            fingerprint,
          },
        });
        await tx.expenseSplit.createMany({
          data: calculated.splits.map((s) => ({
            ...s,
            groupId: data.groupId,
            expenseId: id,
          })),
        });
        const e = await find(tx, data.groupId, id);
        const result = dto(e, user.id, member.role);
        await audit(tx, user, "EXPENSE_CREATED", e);
        return result;
      }, options);
    },
    async list(input: unknown) {
      const user = await actor();
      const { groupId, page } = listExpenseSchema.parse(input);
      return db.$transaction(
        async (tx) => {
          const member = await access(tx, groupId, user.id);
          const rows = await tx.expense.findMany({
            where: { groupId, deletedAt: null },
            include: selection,
            orderBy: [{ date: "desc" }, { id: "desc" }],
            skip: (page - 1) * 25,
            take: 26,
          });
          return {
            items: rows.slice(0, 25).map((e) => dto(e, user.id, member.role)),
            hasNext: rows.length > 25,
            page,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async detail(input: unknown) {
      const user = await actor();
      const { groupId, expenseId } = expenseKeySchema.parse(input);
      return db.$transaction(
        async (tx) => {
          const member = await access(tx, groupId, user.id);
          return dto(await find(tx, groupId, expenseId), user.id, member.role);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async edit(input: unknown) {
      const user = await actor();
      const data = editExpenseSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await access(tx, data.groupId, user.id, true);
        const old = await find(tx, data.groupId, data.expenseId);
        manage(old, user.id, member.role, data.version);
        const calculated = await validate(tx, data, old.id, old);
        await tx.expenseSplit.deleteMany({
          where: { groupId: data.groupId, expenseId: old.id },
        });
        await tx.expense.update({
          where: { id: old.id },
          data: {
            description: data.description,
            amount: calculated.total,
            date: new Date(data.date + "T00:00:00.000Z"),
            paidById: data.paidById,
            splitType: data.splitType,
            version: { increment: 1 },
          },
        });
        await tx.expenseSplit.createMany({
          data: calculated.splits.map((s) => ({
            ...s,
            groupId: data.groupId,
            expenseId: old.id,
          })),
        });
        const e = await find(tx, data.groupId, old.id);
        const result = dto(e, user.id, member.role);
        await audit(tx, user, "EXPENSE_UPDATED", e, old);
        return result;
      }, options);
    },
    async delete(input: unknown) {
      const user = await actor();
      const data = deleteExpenseSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await access(tx, data.groupId, user.id, true);
        const old = await find(tx, data.groupId, data.expenseId);
        manage(old, user.id, member.role, data.version);
        const inactive = await tx.groupMember.findMany({
          where: { groupId: data.groupId, status: { not: "ACTIVE" } },
        });
        if (
          inactive.some(
            (m) =>
              (old.paidById === m.userId ? old.amount : 0n) -
                (old.splits.find((s) => s.userId === m.userId)?.amount ??
                  0n) !==
              0n,
          )
        )
          throw new MoneyError(
            "Deleting this expense would change an inactive member's financial contribution.",
          );
        const deleted = await tx.expense.update({
          where: { id: old.id },
          data: { deletedAt: new Date(), version: { increment: 1 } },
          include: selection,
        });
        await audit(tx, user, "EXPENSE_DELETED", deleted, old);
        return { success: true as const };
      }, options);
    },
  };
}
export type ExpenseService = ReturnType<typeof createExpenseService>;
export type ExpenseDetail = Awaited<ReturnType<ExpenseService["detail"]>>;
