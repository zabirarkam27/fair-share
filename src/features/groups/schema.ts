import { z } from "zod";
export const groupIdSchema = z.uuid();
export const createGroupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give your group a name.")
      .max(80, "Use at most 80 characters."),
    description: z
      .string()
      .trim()
      .max(240, "Use at most 240 characters.")
      .default(""),
  })
  .strict();
export const groupInputSchema = z.object({ groupId: groupIdSchema }).strict();
export const removeMemberSchema = groupInputSchema
  .extend({ memberId: z.string().min(1).max(128) })
  .strict();
export const deleteGroupSchema = groupInputSchema
  .extend({ confirmation: z.string().max(80) })
  .strict();
export const inviteTokenSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{43}$/,
    "This invitation is invalid or no longer available.",
  );
export const joinGroupSchema = z.object({ token: inviteTokenSchema }).strict();
export type CreateGroupInput = z.input<typeof createGroupSchema>;
