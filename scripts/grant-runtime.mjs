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
  console.log(
    `Auth-only table privileges granted to ${test ? "test" : "development"} runtime role.`,
  );
} finally {
  await client.end();
}
