import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  createGroupSchema,
  groupInputSchema,
  removeMemberSchema,
  deleteGroupSchema,
  joinGroupSchema,
} from "./schema";
import { newInvitation, hashInviteToken, INVITE_LIFETIME_MS } from "./invites";
import { readLedgerSnapshots } from "@/features/balances/ledger";

type Identity = { user: { id: string; name: string } };
type SessionResolver = () => Promise<Identity | null>;
type Tx = Prisma.TransactionClient;
export class GroupError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_INVITE"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
const unavailable = () => new GroupError("NOT_FOUND", "Group not found.");
const invalidInvite = () =>
  new GroupError(
    "INVALID_INVITE",
    "This invitation is invalid or no longer available.",
  );

// Dependencies are trusted server bindings. No client input ever selects the actor.
export function createGroupService(
  db: PrismaClient,
  resolveSession: SessionResolver,
) {
  async function actor() {
    const session = await resolveSession();
    if (!session)
      throw new GroupError("UNAUTHENTICATED", "Please sign in to continue.");
    return session.user;
  }
  async function authorize(
    tx: Tx,
    groupId: string,
    userId: string,
    lock = false,
  ) {
    if (lock)
      await tx.$queryRaw`SELECT id FROM groups WHERE id=${groupId}::uuid FOR UPDATE`;
    const member = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });
    if (!member || member.status !== "ACTIVE" || member.group.deletedAt)
      throw unavailable();
    return member;
  }
  function admin(role: string) {
    if (role !== "ADMIN")
      throw new GroupError("FORBIDDEN", "Only the group admin can do that.");
  }
  const writeOptions = {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5000,
    timeout: 10000,
  };
  async function event(
    tx: Tx,
    groupId: string,
    user: Identity["user"],
    type: Prisma.ActivityCreateInput["type"],
    entityId: string,
    after?: Prisma.InputJsonValue,
  ) {
    await tx.activity.create({
      data: {
        groupId,
        actorId: user.id,
        actorName: user.name,
        type,
        entityId,
        ...(after ? { after } : {}),
      },
    });
  }
  return {
    async create(input: unknown) {
      const user = await actor();
      const data = createGroupSchema.parse(input);
      return db.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            ...data,
            members: { create: { userId: user.id, role: "ADMIN" } },
          },
          select: { id: true },
        });
        await event(tx, group.id, user, "GROUP_CREATED", group.id, data);
        return group;
      }, writeOptions);
    },
    async list() {
      const user = await actor();
      return db.$transaction(
        async (tx) => {
          const memberships = await tx.groupMember.findMany({
            where: {
              userId: user.id,
              status: "ACTIVE",
              group: { deletedAt: null },
            },
            select: {
              role: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  createdAt: true,
                  _count: {
                    select: { members: { where: { status: "ACTIVE" } } },
                  },
                },
              },
            },
            orderBy: [{ group: { createdAt: "desc" } }, { groupId: "asc" }],
          });
          return memberships.map((m) => ({
            id: m.group.id,
            name: m.group.name,
            description: m.group.description,
            createdAt: m.group.createdAt.toISOString(),
            role: m.role,
            memberCount: m.group._count.members,
          }));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async detail(input: unknown) {
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(
        async (tx) => {
          const member = await authorize(tx, groupId, user.id);
          const roster = await tx.groupMember.findMany({
            where: { groupId },
            select: {
              userId: true,
              role: true,
              status: true,
              joinedAt: true,
              user: { select: { name: true } },
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }, { userId: "asc" }],
          });
          return {
            id: member.group.id,
            name: member.group.name,
            description: member.group.description,
            createdAt: member.group.createdAt.toISOString(),
            myRole: member.role,
            members: roster.map((m) => ({
              userId: m.userId,
              name: m.user.name,
              role: m.role,
              status: m.status,
              joinedAt: m.joinedAt.toISOString(),
            })),
            invitation:
              member.role === "ADMIN"
                ? {
                    active:
                      !!member.group.inviteTokenHash &&
                      !!member.group.inviteExpiresAt &&
                      member.group.inviteExpiresAt.getTime() > Date.now(),
                    expiresAt:
                      member.group.inviteExpiresAt?.toISOString() ?? null,
                  }
                : null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async members(input: unknown) {
      // Keep this boundary authorized even if called independently from detail UI.
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(
        async (tx) => {
          await authorize(tx, groupId, user.id);
          const rows = await tx.groupMember.findMany({
            where: { groupId },
            select: {
              userId: true,
              role: true,
              status: true,
              user: { select: { name: true } },
            },
            orderBy: [{ role: "asc" }, { userId: "asc" }],
          });
          return rows.map((m) => ({
            userId: m.userId,
            role: m.role,
            status: m.status,
            name: m.user.name,
          }));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async issueInvite(input: unknown) {
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await authorize(tx, groupId, user.id, true);
        admin(member.role);
        const invitation = newInvitation();
        const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
        await tx.group.update({
          where: { id: groupId },
          data: {
            inviteTokenHash: invitation.hash,
            inviteExpiresAt: expiresAt,
          },
        });
        await event(tx, groupId, user, "INVITE_ROTATED", groupId, {
          expiresAt: expiresAt.toISOString(),
        });
        return { token: invitation.token, expiresAt: expiresAt.toISOString() };
      }, writeOptions);
    },
    async revokeInvite(input: unknown) {
      const user = await actor();
      const { groupId } = groupInputSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await authorize(tx, groupId, user.id, true);
        admin(member.role);
        await tx.group.update({
          where: { id: groupId },
          data: { inviteTokenHash: null, inviteExpiresAt: null },
        });
        await event(tx, groupId, user, "INVITE_REVOKED", groupId);
        return { success: true as const };
      }, writeOptions);
    },
    async join(input: unknown) {
      const user = await actor();
      const parsed = joinGroupSchema.safeParse(input);
      if (!parsed.success) throw invalidInvite();
      const hash = hashInviteToken(parsed.data.token);
      return db.$transaction(async (tx) => {
        // The token is a bearer invitation, not permission to read a group's data.
        // Lock first, then re-read hash/expiry to close rotation/delete races.
        const found = await tx.group.findUnique({
          where: { inviteTokenHash: hash },
          select: { id: true },
        });
        if (!found) throw invalidInvite();
        await tx.$queryRaw`SELECT id FROM groups WHERE id=${found.id}::uuid FOR UPDATE`;
        const group = await tx.group.findUnique({ where: { id: found.id } });
        if (
          !group ||
          group.deletedAt ||
          group.inviteTokenHash !== hash ||
          !group.inviteExpiresAt ||
          group.inviteExpiresAt.getTime() <= Date.now()
        )
          throw invalidInvite();
        const existing = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
        });
        if (existing?.status === "REMOVED") throw invalidInvite();
        if (existing?.status === "ACTIVE") return { id: group.id };
        if (
          (await tx.groupMember.count({
            where: { groupId: group.id, status: "ACTIVE" },
          })) >= 100
        )
          throw new GroupError(
            "CONFLICT",
            "This group has reached its member limit.",
          );
        await tx.groupMember.upsert({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
          create: { groupId: group.id, userId: user.id, role: "MEMBER" },
          update: {
            status: "ACTIVE",
            role: "MEMBER",
            departedAt: null,
            joinedAt: new Date(),
          },
        });
        await event(tx, group.id, user, "MEMBER_JOINED", user.id);
        return { id: group.id };
      }, writeOptions);
    },
    async remove(input: unknown) {
      const user = await actor();
      const { groupId, memberId } = removeMemberSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await authorize(tx, groupId, user.id, true);
        admin(member.role);
        const target = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId: memberId } },
        });
        if (!target || target.status !== "ACTIVE") throw unavailable();
        if (target.role === "ADMIN")
          throw new GroupError(
            "CONFLICT",
            "The group admin cannot be removed.",
          );
        // The group lock serializes this full-ledger check with expense writes.
        const ledger = (await readLedgerSnapshots(tx, [groupId])).get(groupId)!;
        const balance = ledger.calculated.members.find(
          (m) => m.memberId === memberId,
        )!;
        if (balance.netPoisha !== 0n)
          throw new GroupError(
            "CONFLICT",
            "This member must have a zero balance before removal.",
          );
        await tx.groupMember.update({
          where: { groupId_userId: { groupId, userId: memberId } },
          data: { status: "REMOVED", departedAt: new Date() },
        });
        await event(tx, groupId, user, "MEMBER_REMOVED", memberId, {
          memberId,
        });
        return { success: true as const };
      }, writeOptions);
    },
    async delete(input: unknown) {
      const user = await actor();
      const { groupId, confirmation } = deleteGroupSchema.parse(input);
      return db.$transaction(async (tx) => {
        const member = await authorize(tx, groupId, user.id, true);
        admin(member.role);
        if (confirmation !== member.group.name)
          throw new GroupError(
            "CONFLICT",
            "Type the exact group name to confirm.",
          );
        await tx.group.update({
          where: { id: groupId },
          data: {
            deletedAt: new Date(),
            inviteTokenHash: null,
            inviteExpiresAt: null,
          },
        });
        await event(tx, groupId, user, "GROUP_DELETED", groupId, {
          name: member.group.name,
        });
        return { success: true as const };
      }, writeOptions);
    },
  };
}
export type GroupService = ReturnType<typeof createGroupService>;
export type GroupDetail = Awaited<ReturnType<GroupService["detail"]>>;
export type GroupSummary = Awaited<ReturnType<GroupService["list"]>>[number];
