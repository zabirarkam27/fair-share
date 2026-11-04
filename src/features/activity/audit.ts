import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { projectMetadata, type ActivityAction } from "./metadata";

// Internal writer only. The caller has already resolved the actor and holds
// the same transaction that mutates the related resource.
export async function writeActivity(
  tx: Prisma.TransactionClient,
  event: {
    groupId: string;
    actor: { id: string; name: string };
    action: ActivityAction;
    resourceId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const before = projectMetadata(event.action, event.before),
    after = projectMetadata(event.action, event.after);
  await tx.activity.create({
    data: {
      groupId: event.groupId,
      actorId: event.actor.id,
      actorName: event.actor.name,
      type: event.action,
      entityId: event.resourceId,
      schemaVersion: 2,
      ...(before !== null ? { before } : {}),
      ...(after !== null ? { after } : {}),
    },
  });
}
