import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/server";
import {
  createGroupService,
  type GroupService,
} from "@/features/groups/service";
import { assertTestDatabase, databaseIdentity } from "../test-database";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100";
const run = randomUUID();
const accounts: { id: string; name: string; cookie: string }[] = [];
const created: string[] = [];
let owner: Client;
let a: GroupService, b: GroupService, c: GroupService;
let groupA: { id: string }, groupB: { id: string };
let sequence = 0;
function service(cookie: string) {
  // Mirror the trusted server boundary: verify the real signed session cookie
  // through Better Auth directly, rather than turn each internal check into
  // another public HTTP request and exhaust the unrelated HTTP rate limiter.
  return createGroupService(prisma, () =>
    auth.api.getSession({ headers: new Headers({ Cookie: cookie }) }),
  );
}
const invalid = { code: "INVALID_INVITE" };
describe("group isolation, permissions and invitation lifecycle on PostgreSQL", () => {
  beforeAll(async () => {
    const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Unsafe fixture database.");
    owner = new Client({
      connectionString: process.env.TEST_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    });
    await owner.connect();
    for (const label of ["A", "B", "C"]) {
      const name = `Group Test ${label} ${run}`;
      // Fixture provisioning uses Better Auth's trusted API; public signup
      // throttling is exercised separately by the HTTP auth suite.
      const response = await auth.api.signUpEmail({
        asResponse: true,
        headers: new Headers({ Origin: base }),
        body: {
          name,
          email: `groups-${label}-${run}@example.test`,
          password: "GroupIntegration!2026",
        },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      accounts.push({
        id: body.user.id,
        name,
        cookie: response.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .join("; "),
      });
    }
    [a, b, c] = accounts.map((account) => service(account.cookie));
  });
  beforeEach(async () => {
    sequence++;
    groupA = await a.create({
      name: `Group A ${run} ${sequence}`,
      description: "A private home",
    });
    created.push(groupA.id);
    groupB = await b.create({ name: `Group B ${run} ${sequence}` });
    created.push(groupB.id);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    if (owner) {
      if (created.length) {
        await owner.query(
          'DELETE FROM activity WHERE "groupId"=ANY($1::uuid[])',
          [created],
        );
        await owner.query(
          'DELETE FROM group_members WHERE "groupId"=ANY($1::uuid[])',
          [created],
        );
        await owner.query("DELETE FROM groups WHERE id=ANY($1::uuid[])", [
          created,
        ]);
      }
      for (const account of accounts)
        await owner.query('DELETE FROM "user" WHERE id=$1', [account.id]);
      await owner.end();
    }
  });
  it("creates the creator as the only admin and lists only their own groups", async () => {
    const detail = await a.detail({ groupId: groupA.id });
    expect(detail.myRole).toBe("ADMIN");
    expect(detail.members).toHaveLength(1);
    expect(detail.members[0].userId).toBe(accounts[0].id);
    const own = await a.list();
    expect(own.some((g) => g.id === groupA.id)).toBe(true);
    expect(own.some((g) => g.id === groupB.id)).toBe(false);
  });
  it("User A cannot access User B’s private group", async () => {
    await expect(a.detail({ groupId: groupB.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Group not found.",
    });
    await expect(a.detail({ groupId: randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Group not found.",
    });
  });
  it("changing the group ID cannot expose another roster", async () => {
    await expect(a.members({ groupId: groupB.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      (await a.members({ groupId: groupA.id })).map((m) => m.userId),
    ).toEqual([accounts[0].id]);
  });
  it("the protected group page returns no private group or member metadata to an outsider", async () => {
    const response = await fetch(base + "/dashboard/groups/" + groupB.id, {
      headers: { Cookie: accounts[0].cookie },
      redirect: "manual",
    });
    const html = await response.text();
    expect(html.includes(`Group B ${run} ${sequence}`)).toBe(false);
    expect(html.includes(accounts[1].name)).toBe(false);
    expect(
      response.status === 404 || html.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
    ).toBe(true);
  });
  it("a normal member cannot remove another member", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    await c.join({ token: invite.token });
    await expect(
      b.remove({ groupId: groupA.id, memberId: accounts[2].id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await a.detail({ groupId: groupA.id })).members.find(
        (m) => m.userId === accounts[2].id,
      )?.status,
    ).toBe("ACTIVE");
  });
  it("a normal member cannot delete a group", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    const detail = await b.detail({ groupId: groupA.id });
    await expect(
      b.delete({ groupId: groupA.id, confirmation: detail.name }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await a.detail({ groupId: groupA.id })).id).toBe(groupA.id);
  });
  it("an admin can remove a member, immediately revoking read/list access", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    await a.remove({ groupId: groupA.id, memberId: accounts[1].id });
    await expect(b.detail({ groupId: groupA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await b.list()).some((g) => g.id === groupA.id)).toBe(false);
    expect(
      (await a.detail({ groupId: groupA.id })).members.find(
        (m) => m.userId === accounts[1].id,
      )?.status,
    ).toBe("REMOVED");
  });
  it("a removed member cannot rejoin using an old valid invitation", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    await a.remove({ groupId: groupA.id, memberId: accounts[1].id });
    await expect(b.join({ token: invite.token })).rejects.toMatchObject(
      invalid,
    );
  });
  it("a valid invitation joins as MEMBER and only its hash is stored", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    const row = (
      await owner.query(
        'SELECT "inviteTokenHash","inviteExpiresAt" FROM groups WHERE id=$1',
        [groupA.id],
      )
    ).rows[0];
    expect(row.inviteTokenHash).not.toBe(invite.token);
    expect(row.inviteTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      JSON.stringify(await a.detail({ groupId: groupA.id })),
    ).not.toContain(row.inviteTokenHash);
    expect(new Date(row.inviteExpiresAt).getTime()).toBeGreaterThan(
      Date.now() + 6 * 86400000,
    );
    expect(await b.join({ token: invite.token })).toEqual({ id: groupA.id });
    expect((await b.detail({ groupId: groupA.id })).myRole).toBe("MEMBER");
    expect(
      JSON.stringify(await b.detail({ groupId: groupA.id })),
    ).not.toContain(invite.token);
    expect((await b.detail({ groupId: groupA.id })).invitation).toBeNull();
  });
  it("invalid and malformed invitations fail identically", async () => {
    for (const token of ["not-a-token", "a".repeat(43)])
      await expect(c.join({ token })).rejects.toMatchObject(invalid);
  });
  it("revoked and replaced invitation tokens fail", async () => {
    const first = await a.issueInvite({ groupId: groupA.id });
    await a.issueInvite({ groupId: groupA.id });
    await expect(b.join({ token: first.token })).rejects.toMatchObject(invalid);
    const current = await a.issueInvite({ groupId: groupA.id });
    await a.revokeInvite({ groupId: groupA.id });
    await expect(b.join({ token: current.token })).rejects.toMatchObject(
      invalid,
    );
  });
  it("expired invitations fail", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await owner.query(
      "UPDATE groups SET \"inviteExpiresAt\"=now()-interval '1 second' WHERE id=$1",
      [groupA.id],
    );
    await expect(b.join({ token: invite.token })).rejects.toMatchObject(
      invalid,
    );
  });
  it("joining twice, including concurrent retries, creates one membership and one event", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await Promise.all([
      b.join({ token: invite.token }),
      b.join({ token: invite.token }),
    ]);
    await b.join({ token: invite.token });
    expect(
      (
        await owner.query(
          'SELECT count(*)::int count FROM group_members WHERE "groupId"=$1 AND "userId"=$2',
          [groupA.id, accounts[1].id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await owner.query(
          'SELECT count(*)::int count FROM activity WHERE "groupId"=$1 AND "actorId"=$2 AND type=\'MEMBER_JOINED\'',
          [groupA.id, accounts[1].id],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it("rechecks a token revoked while a join waits for the group lock", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await owner.query("BEGIN");
    await owner.query("SELECT id FROM groups WHERE id=$1 FOR UPDATE", [
      groupA.id,
    ]);
    const outcome = b.join({ token: invite.token }).then(
      () => "JOINED",
      (error) => error.code as string,
    );
    let observedWait = false;
    try {
      for (let i = 0; i < 50; i++) {
        const locks = await owner.query(
          "SELECT count(*)::int count FROM pg_locks WHERE NOT granted AND locktype='transactionid'",
        );
        if (locks.rows[0].count > 0) {
          observedWait = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await owner.query(
        'UPDATE groups SET "inviteTokenHash"=NULL,"inviteExpiresAt"=NULL WHERE id=$1',
        [groupA.id],
      );
      await owner.query("COMMIT");
    } catch (error) {
      await owner.query("ROLLBACK");
      throw error;
    }
    expect(await outcome).toBe("INVALID_INVITE");
    expect(observedWait).toBe(true);
    expect(
      (
        await owner.query(
          'SELECT count(*)::int count FROM group_members WHERE "groupId"=$1 AND "userId"=$2',
          [groupA.id, accounts[1].id],
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it("non-members cannot remove members or administer invitations/deletion", async () => {
    await expect(
      b.remove({ groupId: groupA.id, memberId: accounts[0].id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.issueInvite({ groupId: groupA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(b.revokeInvite({ groupId: groupA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      b.delete({ groupId: groupA.id, confirmation: "anything" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("normal members cannot issue or revoke invites and cannot promote themselves by posting a role", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    await expect(b.issueInvite({ groupId: groupA.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(b.revokeInvite({ groupId: groupA.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      b.join({ token: invite.token, role: "ADMIN", userId: accounts[0].id }),
    ).rejects.toMatchObject(invalid);
    expect((await b.detail({ groupId: groupA.id })).myRole).toBe("MEMBER");
  });
  it("rejects actor overrides and cross-group removal targets", async () => {
    await expect(
      b.create({ name: "Forged", userId: accounts[0].id, role: "ADMIN" }),
    ).rejects.toBeDefined();
    await expect(
      a.remove({ groupId: groupA.id, memberId: accounts[1].id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      a.remove({ groupId: groupA.id, memberId: accounts[0].id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("an admin can delete a group atomically while preserving history and disabling its link", async () => {
    const invite = await a.issueInvite({ groupId: groupA.id });
    await b.join({ token: invite.token });
    const detail = await a.detail({ groupId: groupA.id });
    await expect(
      a.delete({ groupId: groupA.id, confirmation: "wrong name" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await a.delete({ groupId: groupA.id, confirmation: detail.name });
    await expect(a.detail({ groupId: groupA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(b.members({ groupId: groupA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(c.join({ token: invite.token })).rejects.toMatchObject(
      invalid,
    );
    const row = (
      await owner.query(
        'SELECT "deletedAt","inviteTokenHash" FROM groups WHERE id=$1',
        [groupA.id],
      )
    ).rows[0];
    expect(row.deletedAt).toBeTruthy();
    expect(row.inviteTokenHash).toBeNull();
    expect(
      (
        await owner.query(
          "SELECT count(*)::int count FROM activity WHERE \"groupId\"=$1 AND type='GROUP_DELETED'",
          [groupA.id],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it("anonymous services cannot create/list/read or use a bearer invitation", async () => {
    const anon = service("");
    await expect(anon.create({ name: "Anonymous" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(anon.list()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(anon.detail({ groupId: groupA.id })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    const invite = await a.issueInvite({ groupId: groupA.id });
    await expect(anon.join({ token: invite.token })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
  it("the runtime cannot alter history, and an audit failure rolls back group creation", async () => {
    await expect(
      prisma.activity.deleteMany({ where: { groupId: groupA.id } }),
    ).rejects.toBeDefined();
    const name = "Rollback " + run;
    await owner.query("REVOKE INSERT ON activity FROM fairshare_p1_test_app");
    try {
      await expect(a.create({ name })).rejects.toBeDefined();
      expect(
        (
          await owner.query(
            "SELECT count(*)::int count FROM groups WHERE name=$1",
            [name],
          )
        ).rows[0].count,
      ).toBe(0);
    } finally {
      await owner.query("GRANT INSERT ON activity TO fairshare_p1_test_app");
    }
  });
});
