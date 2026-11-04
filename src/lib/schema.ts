import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import type { Allocation } from "./money";
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
export const groups = pgTable("groups", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  inviteToken: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});
export const members = pgTable(
  "members",
  {
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id),
    role: text().notNull(),
    active: boolean().notNull().default(true),
    joinedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("members_user_idx").on(t.userId),
  ],
);
export const expenses = pgTable(
  "expenses",
  {
    id: text().primaryKey(),
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    description: text().notNull(),
    amount: integer().notNull(),
    date: text().notNull(),
    paidBy: text()
      .notNull()
      .references(() => user.id),
    createdBy: text()
      .notNull()
      .references(() => user.id),
    splitType: text().notNull(),
    inputs: jsonb().$type<{ userId: string; value: string }[]>().notNull(),
    allocations: jsonb().$type<Allocation[]>().notNull(),
    version: integer().notNull().default(1),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("expenses_group_idx").on(t.groupId, t.createdAt)],
);
export const settlements = pgTable(
  "settlements",
  {
    id: text().primaryKey(),
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromId: text()
      .notNull()
      .references(() => user.id),
    toId: text()
      .notNull()
      .references(() => user.id),
    amount: integer().notNull(),
    method: text().notNull(),
    createdBy: text()
      .notNull()
      .references(() => user.id),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("settlements_group_idx").on(t.groupId)],
);
export const activity = pgTable(
  "activity",
  {
    id: text().primaryKey(),
    groupId: text()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    actorId: text()
      .notNull()
      .references(() => user.id),
    action: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("activity_group_idx").on(t.groupId, t.createdAt)],
);
