import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
const test = process.argv.includes("--test");
const connectionString = test
  ? process.env.TEST_MIGRATION_URL
  : process.env.DIRECT_URL;
if (!connectionString)
  throw new Error("Missing migration/owner connection URL.");
const role = test ? "fairshare_p1_test_app" : "fairshare_p1_app";
const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await client.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "user",session,account,verification TO ${role}`,
  );
  const groupTables = await client.query(
    "SELECT to_regclass('public.groups') present",
  );
  if (groupTables.rows[0].present) {
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON TABLE groups,group_members TO ${role}`,
    );
    await client.query(`GRANT SELECT,INSERT ON TABLE activity TO ${role}`);
    await client.query(
      `REVOKE UPDATE,DELETE,TRUNCATE ON TABLE activity FROM ${role}`,
    );
  }
  const expenses = await client.query(
    "SELECT to_regclass('public.expenses') present",
  );
  if (expenses.rows[0].present) {
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON TABLE expenses TO ${role}`,
    );
    await client.query(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE expense_splits TO ${role}`,
    );
  }
  console.log(
    `Scoped application table privileges granted to ${test ? "test" : "development"} runtime role.`,
  );
} finally {
  await client.end();
}
