import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import type { PrismaClient } from "@/generated/prisma/client";

// Password hashing, verification, session tokens and cookies are Better Auth's responsibility.
export function createAuth(
  db: PrismaClient,
  options: { baseURL: string; secret: string },
) {
  return betterAuth({
    appName: "FairShare",
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [options.baseURL],
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    user: { deleteUser: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 60 },
    plugins: [nextCookies()],
  });
}
