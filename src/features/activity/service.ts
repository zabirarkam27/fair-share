import "server-only";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { GroupError } from "@/features/groups/service";
import { readMetadata } from "./metadata";
export const activityCursorSchema = z
  .object({ createdAt: z.iso.datetime(), id: z.uuid() })
  .strict();
export const activityInputSchema = z
  .object({ groupId: z.uuid(), cursor: activityCursorSchema.optional() })
  .strict();
export function createActivityService(
  db: PrismaClient,
  resolveSession: () => Promise<{ user: { id: string } } | null>,
) {
  return {
    async recent() {
      const session = await resolveSession();
      if (!session)
        throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
      // Authorization is part of this query, never a client-supplied group list.
      const rows = await db.activity.findMany({
        where: {
          group: {
            deletedAt: null,
            members: { some: { userId: session.user.id, status: "ACTIVE" } },
          },
        },
        select: {
          id: true,
          groupId: true,
          actorName: true,
          type: true,
          createdAt: true,
          group: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 8,
      });
      return rows.map((row) => ({
        id: row.id,
        groupId: row.groupId,
        groupName: row.group.name,
        actorName: row.actorName,
        action: row.type,
        createdAt: row.createdAt.toISOString(),
      }));
    },
    async list(input: unknown) {
      const session = await resolveSession();
      if (!session)
        throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
      const { groupId, cursor } = activityInputSchema.parse(input);
      return db.$transaction(
        async (tx) => {
          const membership = await tx.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId: session.user.id } },
            select: { status: true, group: { select: { deletedAt: true } } },
          });
          if (
            !membership ||
            membership.status !== "ACTIVE" ||
            membership.group.deletedAt
          )
            throw new GroupError("NOT_FOUND", "Group not found.");
          const rows = await tx.activity.findMany({
            where: {
              groupId,
              ...(cursor
                ? {
                    OR: [
                      { createdAt: { lt: new Date(cursor.createdAt) } },
                      {
                        createdAt: new Date(cursor.createdAt),
                        id: { lt: cursor.id },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              groupId: true,
              actorId: true,
              actorName: true,
              type: true,
              entityId: true,
              before: true,
              after: true,
              createdAt: true,
              schemaVersion: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 26,
          });
          const members = await tx.groupMember.findMany({
            where: { groupId },
            select: { userId: true, user: { select: { name: true } } },
          });
          const items = rows.slice(0, 25).map((row) => ({
            id: row.id,
            groupId: row.groupId,
            actorId: row.actorId,
            actorName: row.actorName,
            action: row.type,
            resourceId: row.entityId,
            before: readMetadata(row.type, row.before, row.schemaVersion),
            after: readMetadata(row.type, row.after, row.schemaVersion),
            createdAt: row.createdAt.toISOString(),
            schemaVersion: row.schemaVersion,
          }));
          const last = items.at(-1);
          return {
            groupId,
            items,
            memberNames: members.map((m) => ({
              memberId: m.userId,
              name: m.user.name,
            })),
            nextCursor:
              rows.length > 25 && last
                ? { id: last.id, createdAt: last.createdAt }
                : null,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: 5000,
          timeout: 10000,
        },
      );
    },
  };
}
export type ActivityPage = Awaited<
  ReturnType<ReturnType<typeof createActivityService>["list"]>
>;
