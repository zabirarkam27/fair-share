import { describe, it, expect } from "vitest";
import { projectMetadata, readMetadata } from "@/features/activity/metadata";
const expense = {
  id: "expense",
  groupId: "group",
  description: "Dinner",
  amountPoisha: "10000",
  date: "2026-11-04",
  paidById: "a",
  createdById: "a",
  splitType: "EXACT",
  version: 1,
  splits: [{ userId: "b", amountPoisha: "10000", inputUnits: "10000" }],
};
describe("audit metadata allowlists", () => {
  it("preserves every financial snapshot field without modifying input", () => {
    const value = Object.freeze({
      ...expense,
      splits: Object.freeze(expense.splits.map((s) => Object.freeze(s))),
    });
    expect(projectMetadata("EXPENSE_UPDATED", value)).toEqual(expense);
  });
  it("strips sensitive and UI fields recursively", () => {
    const projected = projectMetadata("EXPENSE_UPDATED", {
      ...expense,
      email: "private@example.test",
      password: "secret",
      token: "raw-secret",
      requestKey: "key",
      fingerprint: "hash",
      canManage: true,
      splits: [
        {
          ...expense.splits[0],
          sessionToken: "nested-secret",
          email: "nested@example.test",
        },
      ],
    });
    expect(projected).toEqual(expense);
    expect(JSON.stringify(projected)).not.toMatch(
      /secret|example.test|canManage|requestKey|fingerprint/,
    );
  });
  it("never exposes invitation credentials or hashes", () => {
    expect(
      projectMetadata("INVITE_ROTATED", {
        expiresAt: "2026-11-11T00:00:00.000Z",
        token: "raw",
        inviteTokenHash: "hash",
        url: "secret-link",
      }),
    ).toEqual({ expiresAt: "2026-11-11T00:00:00.000Z" });
  });
  it("supports legacy member and financial metadata", () => {
    expect(readMetadata("MEMBER_REMOVED", { memberId: "b" }, 1)).toEqual({
      memberId: "b",
    });
    expect(readMetadata("MEMBER_JOINED", null, 1)).toBeNull();
    expect(readMetadata("EXPENSE_UPDATED", expense, 1)).toEqual(expense);
  });
  it("hides unsupported or malformed metadata instead of dumping raw values", () => {
    expect(
      readMetadata("EXPENSE_UPDATED", { password: "secret" }, 2),
    ).toBeNull();
    expect(readMetadata("EXPENSE_UPDATED", expense, 999)).toBeNull();
    expect(() =>
      projectMetadata("EXPENSE_UPDATED", { ...expense, amountPoisha: "1.1" }),
    ).toThrow();
  });
  it("retains explicit deletion and membership transitions", () => {
    expect(
      projectMetadata("MEMBER_REMOVED", {
        memberId: "b",
        name: "B",
        role: "MEMBER",
        status: "REMOVED",
        joinedAt: "2026-11-04T00:00:00.000Z",
        departedAt: "2026-11-04T01:00:00.000Z",
      }),
    ).toMatchObject({
      status: "REMOVED",
      departedAt: "2026-11-04T01:00:00.000Z",
    });
    expect(
      projectMetadata("EXPENSE_DELETED", {
        ...expense,
        deletedAt: "2026-11-04T01:00:00.000Z",
      }),
    ).toMatchObject({ deletedAt: "2026-11-04T01:00:00.000Z" });
  });
});
