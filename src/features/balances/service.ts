import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { groupInputSchema } from "@/features/groups/schema";
import { GroupError } from "@/features/groups/service";
import { currentUserBalance } from "./engine";
import { readLedgerSnapshots, type LedgerSnapshot } from "./ledger";

type Identity = { user: { id: string } };
const readOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 5000,
  timeout: 15000,
};
const serializeSummary = (summary: ReturnType<typeof currentUserBalance>) => ({
  netPoisha: summary.netPoisha.toString(),
  owedByPoisha: summary.owedByPoisha.toString(),
  owedToPoisha: summary.owedToPoisha.toString(),
});
function details(snapshot: LedgerSnapshot, userId: string) {
  const result = snapshot.calculated;
  const roster = new Map(snapshot.members.map((m) => [m.userId, m]));
  const expenseMetadata = new Map(snapshot.expenses.map((e) => [e.id, e]));
  const settlementMetadata = new Map(
    snapshot.settlements.map((s) => [s.id, s]),
  );
  const names = (memberId: string) => roster.get(memberId)!.user.name;
  return {
    currentUser: serializeSummary(currentUserBalance(result, userId)),
    groupTotalPoisha: result.groupTotalPoisha.toString(),
    zeroSumVerified: result.zeroSumVerified,
    totalExpensePoisha: result.totalExpensePoisha.toString(),
    totalSettlementPoisha: result.totalSettlementPoisha.toString(),
    members: result.members.map((m) => ({
      memberId: m.memberId,
      name: names(m.memberId),
      status: roster.get(m.memberId)!.status,
      paidPoisha: m.paidPoisha.toString(),
      allocatedPoisha: m.allocatedPoisha.toString(),
      sentPoisha: m.sentPoisha.toString(),
      receivedPoisha: m.receivedPoisha.toString(),
      netPoisha: m.netPoisha.toString(),
    })),
    expenses: result.expenses.map((e) => {
      const meta = expenseMetadata.get(e.expenseId)!;
      return {
        expenseId: e.expenseId,
        description: meta.description,
        date: meta.date.toISOString().slice(0, 10),
        version: meta.version,
        amountPoisha: e.amountPoisha.toString(),
        contributions: e.contributions.map((c) => ({
          memberId: c.memberId,
          name: names(c.memberId),
          paidPoisha: c.paidPoisha.toString(),
          allocatedPoisha: c.allocatedPoisha.toString(),
          netPoisha: c.netPoisha.toString(),
        })),
      };
    }),
    settlements: result.settlements.map((s) => {
      const meta = settlementMetadata.get(s.settlementId)!;
      return {
        settlementId: s.settlementId,
        fromId: meta.fromId,
        toId: meta.toId,
        fromName: names(meta.fromId),
        toName: names(meta.toId),
        method: meta.method,
        createdAt: meta.createdAt.toISOString(),
        amountPoisha: s.amountPoisha.toString(),
        contributions: s.contributions.map((c) => ({
          memberId: c.memberId,
          name: names(c.memberId),
          netPoisha: c.netPoisha.toString(),
        })),
      };
    }),
  };
}
export function createBalanceService(
  db: PrismaClient,
  resolveSession: () => Promise<Identity | null>,
) {
  async function actor() {
    const s = await resolveSession();
    if (!s)
      throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
    return s.user;
  }
  return {
    async detail(input: unknown) {
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId: user.id } },
          select: { status: true, group: { select: { deletedAt: true } } },
        });
        if (!member || member.status !== "ACTIVE" || member.group.deletedAt)
          throw new GroupError("NOT_FOUND", "Group not found.");
        const snapshots = await readLedgerSnapshots(tx, [groupId]);
        return { groupId, ...details(snapshots.get(groupId)!, user.id) };
      }, readOptions);
    },
    async overview() {
      const user = await actor();
      return db.$transaction(async (tx) => {
        const memberships = await tx.groupMember.findMany({
          where: {
            userId: user.id,
            status: "ACTIVE",
            group: { deletedAt: null },
          },
          select: { groupId: true, group: { select: { name: true } } },
          orderBy: { groupId: "asc" },
        });
        const snapshots = await readLedgerSnapshots(
          tx,
          memberships.map((m) => m.groupId),
        );
        let owedBy = 0n,
          owedTo = 0n;
        const groups = memberships.map((m) => {
          const summary = currentUserBalance(
            snapshots.get(m.groupId)!.calculated,
            user.id,
          );
          // Separate groups are separate obligations: do not offset one group's
          // receivable against money the user owes in another group.
          owedBy += summary.owedByPoisha;
          owedTo += summary.owedToPoisha;
          return {
            groupId: m.groupId,
            name: m.group.name,
            ...serializeSummary(summary),
          };
        });
        return {
          groups,
          owedByPoisha: owedBy.toString(),
          owedToPoisha: owedTo.toString(),
          zeroSumVerified: true as const,
        };
      }, readOptions);
    },
  };
}
export type BalanceDetail = Awaited<
  ReturnType<ReturnType<typeof createBalanceService>["detail"]>
>;
export type BalanceOverview = Awaited<
  ReturnType<ReturnType<typeof createBalanceService>["overview"]>
>;
