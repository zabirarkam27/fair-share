import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { calculateBalances } from "./engine";

// Internal trusted reader, never a Server Action. Caller must authorize scope
// and hold a consistent read transaction (or the group write lock).
export async function readLedgerSnapshots(
  tx: Prisma.TransactionClient,
  groupIds: readonly string[],
) {
  const ids = [...new Set(groupIds)];
  const members = ids.length
    ? await tx.groupMember.findMany({
        where: { groupId: { in: ids } },
        select: {
          groupId: true,
          userId: true,
          status: true,
          user: { select: { name: true } },
        },
        orderBy: { userId: "asc" },
      })
    : [];
  const expenses = ids.length
    ? await tx.expense.findMany({
        where: { groupId: { in: ids }, deletedAt: null },
        select: {
          id: true,
          groupId: true,
          amount: true,
          paidById: true,
          description: true,
          date: true,
          version: true,
          splits: { select: { userId: true, amount: true } },
        },
        orderBy: [{ date: "desc" }, { id: "asc" }],
      })
    : [];
  const settlements = ids.length
    ? await tx.settlement.findMany({
        where: { groupId: { in: ids } },
        select: {
          id: true,
          groupId: true,
          fromId: true,
          toId: true,
          amount: true,
          method: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      })
    : [];
  const groups = new Map(
    ids.map((id) => [
      id,
      {
        members: [] as typeof members,
        expenses: [] as typeof expenses,
        settlements: [] as typeof settlements,
      },
    ]),
  );
  for (const m of members) groups.get(m.groupId)!.members.push(m);
  for (const e of expenses) groups.get(e.groupId)!.expenses.push(e);
  for (const s of settlements) groups.get(s.groupId)!.settlements.push(s);
  return new Map(
    [...groups].map(([groupId, rows]) => [
      groupId,
      {
        ...rows,
        calculated: calculateBalances({
          groupId,
          memberIds: rows.members.map((m) => m.userId),
          expenses: rows.expenses.map((e) => ({
            id: e.id,
            groupId: e.groupId,
            paidById: e.paidById,
            amountPoisha: e.amount,
            splits: e.splits.map((s) => ({
              memberId: s.userId,
              amountPoisha: s.amount,
            })),
          })),
          settlements: rows.settlements.map((s) => ({
            id: s.id,
            groupId: s.groupId,
            fromId: s.fromId,
            toId: s.toId,
            amountPoisha: s.amount,
          })),
        }),
      },
    ]),
  );
}
export type LedgerSnapshot =
  Awaited<ReturnType<typeof readLedgerSnapshots>> extends Map<string, infer V>
    ? V
    : never;
