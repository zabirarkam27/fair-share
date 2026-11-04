import "server-only";
import { prisma } from "@/lib/db/prisma";
import { createAuth } from "./config";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;
if (!baseURL || !secret || secret.length < 32) {
  throw new Error(
    "Set BETTER_AUTH_URL and a random BETTER_AUTH_SECRET of at least 32 characters.",
  );
}
export const auth = createAuth(prisma, { baseURL, secret });
