import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const name = z.string().max(1000);
const poisha = z.string().regex(/^\d{1,30}$/);
const timestamp = z.iso.datetime();
const group = z.object({
  name: z.string().max(80).optional(),
  description: z.string().max(240).optional(),
  deletedAt: timestamp.nullable().optional(),
});
const member = z.object({
  memberId: id.optional(),
  name: name.optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  status: z.enum(["ACTIVE", "LEFT", "REMOVED"]).optional(),
  joinedAt: timestamp.optional(),
  departedAt: timestamp.nullable().optional(),
});
const expense = z.object({
  id,
  groupId: id,
  description: z.string().max(160),
  amountPoisha: poisha,
  date: z.iso.date(),
  paidById: id,
  payerName: name.optional(),
  createdById: id,
  creatorName: name.optional(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]),
  version: z.number().int().positive(),
  deletedAt: timestamp.nullable().optional(),
  splits: z
    .array(
      z.object({
        userId: id,
        amountPoisha: poisha,
        inputUnits: poisha.nullable(),
      }),
    )
    .min(1)
    .max(100),
});
const settlement = z.object({
  id: id.optional(),
  groupId: id.optional(),
  fromId: id,
  toId: id,
  amountPoisha: poisha,
  method: z.enum(["BKASH", "CASH", "BANK"]),
  createdById: id,
  createdAt: timestamp.optional(),
});
const invite = z.object({
  active: z.boolean().optional(),
  expiresAt: timestamp.nullable().optional(),
});
// Zod objects strip unlisted properties at every level. Never pass through raw
// request/auth/Prisma metadata, even for older records written by prior phases.
export const metadataSchemas = {
  GROUP_CREATED: group,
  GROUP_DELETED: group,
  MEMBER_JOINED: member,
  MEMBER_REMOVED: member,
  EXPENSE_CREATED: expense,
  EXPENSE_UPDATED: expense,
  EXPENSE_DELETED: expense,
  SETTLEMENT_RECORDED: settlement,
  INVITE_ROTATED: invite,
  INVITE_REVOKED: invite,
} as const;
export type ActivityAction = keyof typeof metadataSchemas;
export type ActivitySnapshot = z.infer<
  (typeof metadataSchemas)[ActivityAction]
>;
export function projectMetadata(
  action: ActivityAction,
  value: unknown,
): ActivitySnapshot | null {
  if (value === null || value === undefined) return null;
  return metadataSchemas[action].parse(value);
}
export function readMetadata(
  action: ActivityAction,
  value: unknown,
  schemaVersion: number,
) {
  if (schemaVersion !== 1 && schemaVersion !== 2) return null;
  try {
    return projectMetadata(action, value);
  } catch {
    return null;
  }
}
