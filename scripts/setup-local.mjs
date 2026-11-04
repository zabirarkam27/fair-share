import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Client } from "pg";

// Provision only our already initialized workspace-local cluster, never a guessed server.
mkdirSync(".local", { recursive: true });
const archive = ".local/reference.env.local";
if (!existsSync(archive) && !existsSync(".local/admin.env")) {
  if (!existsSync(".env.local"))
    throw new Error(
      "Initialize the local PostgreSQL cluster first; see README.",
    );
  writeFileSync(archive, readFileSync(".env.local"));
}
const previous = readFileSync(
  existsSync(".local/admin.env") ? ".local/admin.env" : archive,
  "utf8",
);
const adminUrl =
  process.env.PG_ADMIN_URL ??
  previous.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!adminUrl)
  throw new Error("Set PG_ADMIN_URL for the owned workspace cluster.");
const admin = new Client({
  connectionString: adminUrl,
  connectionTimeoutMillis: 5000,
});
await admin.connect();
try {
  const directory = (await admin.query("SHOW data_directory")).rows[0]
    .data_directory;
  const expected = resolve(".local/pgdata").replaceAll("\\", "/").toLowerCase();
  if (String(directory).replaceAll("\\", "/").toLowerCase() !== expected)
    throw new Error(
      "Refusing to provision a PostgreSQL cluster outside this workspace.",
    );
  const settingsPath = ".local/phase1-db.json";
  const credentials = existsSync(settingsPath)
    ? JSON.parse(readFileSync(settingsPath, "utf8"))
    : {
        devOwner: randomBytes(24).toString("hex"),
        devApp: randomBytes(24).toString("hex"),
        testOwner: randomBytes(24).toString("hex"),
        testApp: randomBytes(24).toString("hex"),
        secret: randomBytes(32).toString("hex"),
      };
  writeFileSync(settingsPath, JSON.stringify(credentials, null, 2));
  // Names are fixed code constants; passwords are generated hex, never user SQL input.
  for (const [role, key] of [
    ["fairshare_p1_owner", "devOwner"],
    ["fairshare_p1_app", "devApp"],
    ["fairshare_p1_test_owner", "testOwner"],
    ["fairshare_p1_test_app", "testApp"],
  ]) {
    if (!/^[a-f0-9]{48}$/.test(credentials[key]))
      throw new Error("Invalid local credential file.");
    const exists = await admin.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1",
      [role],
    );
    if (!exists.rowCount)
      await admin.query(
        `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${credentials[key]}'`,
      );
  }
  for (const [name, owner, app] of [
    ["fairshare_phase1", "fairshare_p1_owner", "fairshare_p1_app"],
    ["fairshare_test", "fairshare_p1_test_owner", "fairshare_p1_test_app"],
    ["fairshare_shadow", "fairshare_p1_owner", "fairshare_p1_owner"],
  ]) {
    if (
      !(await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
        .rowCount
    )
      await admin.query(`CREATE DATABASE ${name} OWNER ${owner}`);
    await admin.query(`REVOKE CONNECT ON DATABASE ${name} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${name} TO ${owner}, ${app}`);
    await admin.query(
      `REVOKE ALL ON DATABASE ${name} FROM ${name === "fairshare_test" ? "fairshare_p1_app" : "fairshare_p1_test_app"}`,
    );
  }
  // Restrict our test roles even where PostgreSQL's default PUBLIC CONNECT exists.
  // This changes only authentication rules for these two new roles in our owned cluster.
  const hbaPath = resolve(".local/pgdata/pg_hba.conf");
  const marker = "# BEGIN FAIRSHARE PHASE1 TEST ISOLATION";
  const endMarker = "# END FAIRSHARE PHASE1 TEST ISOLATION";
  const hba = readFileSync(hbaPath, "utf8").replace(
    new RegExp(marker + "[\\s\\S]*?" + endMarker + "\\r?\\n?", "g"),
    "",
  );
  const testRoles = "fairshare_p1_test_app,fairshare_p1_test_owner";
  writeFileSync(
    hbaPath,
    `${marker}\nhost fairshare_test ${testRoles} 127.0.0.1/32 scram-sha-256\nhost all ${testRoles} 127.0.0.1/32 reject\n${endMarker}\n${hba}`,
  );
  await admin.query("SELECT pg_reload_conf()");
  const root = new URL(adminUrl);
  const url = (role, password, database) => {
    const u = new URL(root);
    u.username = role;
    u.password = password;
    u.pathname = "/" + database;
    u.search = "";
    return u.href;
  };
  const env = `DATABASE_URL=${url("fairshare_p1_app", credentials.devApp, "fairshare_phase1")}\nDIRECT_URL=${url("fairshare_p1_owner", credentials.devOwner, "fairshare_phase1")}\nSHADOW_DATABASE_URL=${url("fairshare_p1_owner", credentials.devOwner, "fairshare_shadow")}\nTEST_DATABASE_URL=${url("fairshare_p1_test_app", credentials.testApp, "fairshare_test")}\nTEST_MIGRATION_URL=${url("fairshare_p1_test_owner", credentials.testOwner, "fairshare_test")}\nBETTER_AUTH_SECRET=${credentials.secret}\nBETTER_AUTH_URL=http://127.0.0.1:3000\n`;
  writeFileSync(".env.local", env);
  console.log(
    "Phase 1 development/test/shadow databases and restricted runtime roles ready. Existing reference database preserved.",
  );
} finally {
  await admin.end();
}
