import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { pool } from "../src/lib/db";
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(48319201)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of readdirSync("migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync("migrations/" + name, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const old = await client.query(
      "SELECT checksum FROM _migrations WHERE name=$1",
      [name],
    );
    if (old.rowCount) {
      if (old.rows[0].checksum !== checksum)
        throw new Error("Applied migration changed: " + name);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO _migrations(name,checksum) VALUES($1,$2)", [
      name,
      checksum,
    ]);
    console.log("Applied " + name);
  }
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
