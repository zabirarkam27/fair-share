import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const root = resolve(".local");
mkdirSync(root, { recursive: true });
const bin =
  process.env.PG_BIN ||
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "");
const exe = (name) =>
  bin ? join(bin, name + (process.platform === "win32" ? ".exe" : "")) : name;
const run = (name, args, check = true) => {
  const result = spawnSync(exe(name), args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: name === "pg_ctl" ? "ignore" : "pipe",
  });
  if (check && result.status !== 0)
    throw new Error(
      result.stderr ||
        result.stdout ||
        (result.error ? String(result.error) : '') ||
        `${name} failed; check .local/postgres.log`,
    );
  return result;
};
const data = join(root, "pgdata");
if (process.argv[2] === "stop") {
  run("pg_ctl", ["-D", data, "-m", "fast", "stop"]);
  console.log("Local PostgreSQL stopped.");
  process.exit(0);
}
if (!existsSync(join(data, "PG_VERSION"))) {
  const password = randomBytes(24).toString("hex");
  const pw = join(root, "init-password");
  writeFileSync(pw, password);
  run("initdb", [
    "-D",
    data,
    "-U",
    "fairshare",
    "--auth=scram-sha-256",
    "--pwfile=" + pw,
    "--encoding=UTF8",
    "--locale=C",
  ]);
  // Development-only credentials remain in ignored local files.
  const envPath = resolve(".env.local");
  if (existsSync(envPath))
    throw new Error(
      "Refusing to overwrite .env.local. Configure DATABASE_URL manually for the new local database.",
    );
  writeFileSync(
    envPath,
    `DATABASE_URL=postgresql://fairshare:${password}@127.0.0.1:55432/fairshare\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://127.0.0.1:3000\n`,
  );
}
if (run("pg_ctl", ["-D", data, "status"], false).status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    "-p 55432 -h 127.0.0.1",
    "-w",
    "start",
  ]);
const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!url) throw new Error("Missing DATABASE_URL.");
const { Client } = await import("pg");
const client = new Client({
  connectionString: url.replace(/\/fairshare$/, "/postgres"),
  connectionTimeoutMillis: 5000,
});
await client.connect();
const result = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='fairshare'",
);
if (!result.rowCount) await client.query("CREATE DATABASE fairshare");
await client.end();
console.log(
  "PostgreSQL ready on 127.0.0.1:55432. Local environment configured.",
);
