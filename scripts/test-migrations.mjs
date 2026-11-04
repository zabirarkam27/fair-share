import { config } from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  assertTestDatabase,
  databaseIdentity,
} from "../tests/test-database.ts";
config({ path: ".env.local", quiet: true });
const runtime = assertTestDatabase(process.env.TEST_DATABASE_URL, [
  process.env.DATABASE_URL,
  process.env.PRODUCTION_DATABASE_URL,
]);
if (
  !process.env.TEST_MIGRATION_URL ||
  databaseIdentity(runtime) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
)
  throw new Error("Unsafe migration-check database.");
// Create a new namespace; never reset public or reuse any existing schema.
const schema = "phase3_migration_" + randomUUID().replaceAll("-", "");
if (!/^phase3_migration_[a-f0-9]{32}$/.test(schema))
  throw new Error("Unexpected schema.");
const db = new Client({
  connectionString: process.env.TEST_MIGRATION_URL,
  connectionTimeoutMillis: 5000,
});
const url = new URL(process.env.TEST_MIGRATION_URL);
url.searchParams.set("schema", schema);
await db.connect();
let created = false;
try {
  await db.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      windowsHide: true,
      stdio: "inherit",
      env: { ...process.env, MIGRATION_DATABASE_URL: url.href },
    },
  );
  const migrations = await db.query(
    `SELECT count(*)::int n FROM "${schema}"._prisma_migrations WHERE finished_at IS NOT NULL`,
  );
  const expected = readdirSync("prisma/migrations").filter((name) =>
    existsSync(join("prisma/migrations", name, "migration.sql")),
  ).length;
  if (migrations.rows[0].n !== expected)
    throw new Error("Incomplete clean migration chain.");
  const tables = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema=$1",
    [schema],
  );
  for (const name of ["expense_splits", "settlements"])
    if (!tables.rows.some((x) => x.table_name === name))
      throw new Error("Missing financial table.");
  console.log(
    `All ${expected} migrations succeeded from an empty isolated PostgreSQL schema.`,
  );
} finally {
  if (created) await db.query(`DROP SCHEMA "${schema}" CASCADE`);
  await db.end();
}
