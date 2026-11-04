import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import {
  assertTestDatabase,
  databaseIdentity,
} from "../tests/test-database.ts";
config({ path: ".env.local", quiet: true });
const test = process.argv.includes("--test");
let migrationURL = process.env.DIRECT_URL;
if (test) {
  const runtime = assertTestDatabase(process.env.TEST_DATABASE_URL, [
    process.env.DATABASE_URL,
    process.env.PRODUCTION_DATABASE_URL,
  ]);
  migrationURL = process.env.TEST_MIGRATION_URL;
  if (
    !migrationURL ||
    databaseIdentity(runtime) !== databaseIdentity(migrationURL)
  )
    throw new Error(
      "Test migration credentials must target the same isolated test database.",
    );
}
if (!migrationURL) throw new Error("Set a migration connection URL.");
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    env: { ...process.env, MIGRATION_DATABASE_URL: migrationURL },
    windowsHide: true,
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const grants = spawnSync(
  process.execPath,
  ["scripts/grant-runtime.mjs", ...(test ? ["--test"] : [])],
  { windowsHide: true, stdio: "inherit" },
);
process.exitCode = grants.status ?? 1;
