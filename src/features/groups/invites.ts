import { randomBytes, createHash } from "node:crypto";
import { inviteTokenSchema } from "./schema";
export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export function hashInviteToken(raw: string) {
  return createHash("sha256")
    .update(inviteTokenSchema.parse(raw), "utf8")
    .digest("hex");
}
export function newInvitation() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}
