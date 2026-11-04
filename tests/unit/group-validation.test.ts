import { describe, it, expect } from "vitest";
import {
  createGroupSchema,
  groupInputSchema,
  removeMemberSchema,
  joinGroupSchema,
} from "@/features/groups/schema";
import { newInvitation, hashInviteToken } from "@/features/groups/invites";
import { inviteReturn } from "@/features/auth/invite-return";
describe("group payload and invitation boundaries", () => {
  it("validates bounded names and descriptions", () => {
    expect(
      createGroupSchema.parse({ name: "  Flat  ", description: " Our home " }),
    ).toEqual({ name: "Flat", description: "Our home" });
    for (const name of ["", " ", "x".repeat(81)])
      expect(createGroupSchema.safeParse({ name }).success).toBe(false);
    expect(
      createGroupSchema.safeParse({
        name: "Flat",
        description: "x".repeat(241),
      }).success,
    ).toBe(false);
  });
  it("rejects client actor/role overrides and unknown resource fields", () => {
    expect(
      createGroupSchema.safeParse({
        name: "Flat",
        userId: "other",
        role: "ADMIN",
      }).success,
    ).toBe(false);
    expect(
      groupInputSchema.safeParse({
        groupId: crypto.randomUUID(),
        userId: "other",
      }).success,
    ).toBe(false);
    expect(
      removeMemberSchema.safeParse({
        groupId: crypto.randomUUID(),
        memberId: "target",
        role: "ADMIN",
      }).success,
    ).toBe(false);
  });
  it("generates 256-bit URL-safe random tokens and stable hashes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const invite = newInvitation();
      expect(Buffer.from(invite.token, "base64url").length).toBe(32);
      expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(invite.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hashInviteToken(invite.token)).toBe(invite.hash);
      seen.add(invite.token);
    }
    expect(seen.size).toBe(100);
  });
  it("rejects malformed invitations and arbitrary return redirects", () => {
    for (const token of [
      "",
      "../../dashboard",
      "https://evil.example",
      "x".repeat(1000),
    ]) {
      expect(joinGroupSchema.safeParse({ token }).success).toBe(false);
      expect(inviteReturn(token)).toBeUndefined();
    }
    expect(inviteReturn(["x".repeat(43)])).toBeUndefined();
    const { token } = newInvitation();
    expect(inviteReturn(token)).toBe(token);
  });
});
