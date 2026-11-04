import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { GroupError } from "@/features/groups/service";
import { groupInputSchema } from "@/features/groups/schema";
import { readLedgerSnapshots } from "@/features/balances/ledger";
import { parsePoisha, MoneyError } from "@/features/expenses/money";
import { suggestPayments } from "./engine";
import { recordSettlementSchema } from "./schema";
type Identity = { user: { id: string; name: string } };
export function createSettlementService(
  db: PrismaClient,
  resolveSession: () => Promise<Identity | null>,
) {
  async function actor() {
    const s = await resolveSession();
    if (!s)
      throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
    return s.user;
  }
  async function access(
    tx: Prisma.TransactionClient,
    groupId: string,
    userId: string,
    lock = false,
  ) {
    if (lock)
      await tx.$queryRaw`SELECT id FROM groups WHERE id=${groupId}::uuid FOR UPDATE`;
    const member = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: { select: { deletedAt: true } } },
    });
    if (!member || member.status !== "ACTIVE" || member.group.deletedAt)
      throw new GroupError("NOT_FOUND", "Group not found.");
    return member;
  }
  async function snapshot(tx: Prisma.TransactionClient, groupId: string) {
    return (await readLedgerSnapshots(tx, [groupId])).get(groupId)!;
  }
  return {
    async suggestions(input: unknown) {
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(
        async (tx) => {
          const actorMember = await access(tx, groupId, user.id);
          const ledger = await snapshot(tx, groupId);
          const roster = new Map(ledger.members.map((m) => [m.userId, m]));
          if (
            ledger.calculated.members.some(
              (m) =>
                m.netPoisha !== 0n &&
                roster.get(m.memberId)!.status !== "ACTIVE",
            )
          )
            throw new GroupError(
              "CONFLICT",
              "An inactive member has an unresolved balance. Review group history first.",
            );
          const plan = suggestPayments(ledger.calculated.members);
          return {
            groupId,
            algorithm: plan.algorithm,
            minimumGuaranteed: plan.minimumGuaranteed,
            clearsBalances: plan.clearsBalances,
            payments: plan.payments.map((p) => ({
              fromId: p.fromId,
              toId: p.toId,
              fromName: roster.get(p.fromId)!.user.name,
              toName: roster.get(p.toId)!.user.name,
              amountPoisha: p.amountPoisha.toString(),
              canRecord:
                actorMember.role === "ADMIN" ||
                p.fromId === user.id ||
                p.toId === user.id,
            })),
            members: ledger.calculated.members
              .filter((m) => roster.get(m.memberId)!.status === "ACTIVE")
              .map((m) => ({
                memberId: m.memberId,
                name: roster.get(m.memberId)!.user.name,
                netPoisha: m.netPoisha.toString(),
              })),
            currentUserId: user.id,
            isAdmin: actorMember.role === "ADMIN",
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    },
    async record(input: unknown) {
      const user = await actor();
      const data = recordSettlementSchema.parse(input);
      const amount = parsePoisha(data.amount);
      if (amount <= 0n)
        throw new MoneyError("Settlement amount must be positive.");
      return db.$transaction(
        async (tx) => {
          const member = await access(tx, data.groupId, user.id, true);
          const existing = await tx.settlement.findUnique({
            where: {
              groupId_createdById_requestKey: {
                groupId: data.groupId,
                createdById: user.id,
                requestKey: data.requestKey,
              },
            },
          });
          let record = existing;
          if (existing) {
            if (
              existing.fromId !== data.fromId ||
              existing.toId !== data.toId ||
              existing.amount !== amount ||
              existing.method !== data.method
            )
              throw new GroupError(
                "CONFLICT",
                "This request key was already used for a different settlement.",
              );
          } else {
            if (
              member.role !== "ADMIN" &&
              user.id !== data.fromId &&
              user.id !== data.toId
            )
              throw new GroupError(
                "FORBIDDEN",
                "Only the sender, receiver or group admin can record this payment.",
              );
            if (data.fromId === data.toId)
              throw new MoneyError(
                "Sender and receiver must be different members.",
              );
            const ledger = await snapshot(tx, data.groupId);
            const sender = ledger.members.find((m) => m.userId === data.fromId),
              receiver = ledger.members.find((m) => m.userId === data.toId);
            if (
              !sender ||
              !receiver ||
              sender.status !== "ACTIVE" ||
              receiver.status !== "ACTIVE"
            )
              throw new GroupError(
                "NOT_FOUND",
                "Select active members of this group.",
              );
            const debtor = ledger.calculated.members.find(
                (m) => m.memberId === data.fromId,
              )!,
              creditor = ledger.calculated.members.find(
                (m) => m.memberId === data.toId,
              )!;
            if (
              debtor.netPoisha >= 0n ||
              creditor.netPoisha <= 0n ||
              amount > -debtor.netPoisha ||
              amount > creditor.netPoisha
            )
              throw new GroupError(
                "CONFLICT",
                "This payment exceeds the current outstanding balances. Refresh the group and check the amount.",
              );
            record = await tx.settlement.create({
              data: {
                groupId: data.groupId,
                fromId: data.fromId,
                toId: data.toId,
                createdById: user.id,
                amount,
                method: data.method,
                requestKey: data.requestKey,
              },
            });
            await tx.activity.create({
              data: {
                groupId: data.groupId,
                actorId: user.id,
                actorName: user.name,
                type: "SETTLEMENT_RECORDED",
                entityId: record.id,
                after: {
                  fromId: record.fromId,
                  toId: record.toId,
                  amountPoisha: record.amount.toString(),
                  method: record.method,
                  createdById: user.id,
                },
              },
            });
          }
          const recalculated = await snapshot(tx, data.groupId);
          return {
            id: record!.id,
            fromId: record!.fromId,
            toId: record!.toId,
            amountPoisha: record!.amount.toString(),
            method: record!.method,
            replayed: !!existing,
            balances: recalculated.calculated.members.map((m) => ({
              memberId: m.memberId,
              netPoisha: m.netPoisha.toString(),
            })),
            groupTotalPoisha:
              recalculated.calculated.groupTotalPoisha.toString(),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    },
  };
}
export type SettlementSuggestions = Awaited<
  ReturnType<ReturnType<typeof createSettlementService>["suggestions"]>
>;
