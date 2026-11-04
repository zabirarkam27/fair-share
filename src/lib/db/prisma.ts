import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function createPrisma(connectionString: string) {
  // The pg adapter normalizes timestamptz values as UTC. Explicitly request UTC
  // so a non-UTC PostgreSQL server cannot shift session-expiration instants.
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    options: "-c timezone=UTC",
  });
  return new PrismaClient({ adapter });
}

const globalDb = globalThis as unknown as { fairsharePrisma?: PrismaClient };
const url = process.env.DATABASE_URL;
if (!url)
  throw new Error(
    "DATABASE_URL is required. Follow README setup instructions.",
  );
export const prisma = globalDb.fairsharePrisma ?? createPrisma(url);
if (process.env.NODE_ENV !== "production") globalDb.fairsharePrisma = prisma;
