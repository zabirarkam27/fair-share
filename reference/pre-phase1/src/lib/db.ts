import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { fairsharePool?: Pool };
export const pool =
  globalDb.fairsharePool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
if (process.env.NODE_ENV !== "production") globalDb.fairsharePool = pool;
export const db = drizzle(pool, { schema });
