import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const root = resolve(".local");
mkdirSync(root, { recursive: true });
const data = join(root, "pgdata");
const bin =
  process.env.PG_BIN ??
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "");
const executable = (name) =>
  bin ? join(bin, name + (process.platform === "win32" ? ".exe" : "")) : name;
function run(name, args, check = true) {
  const result = spawnSync(executable(name), args, {
    windowsHide: true,
    stdio: "inherit",
  });
  if (check && result.status !== 0)
    throw new Error(`${name} failed. Check .local/postgres-phase1.log.`);
  return result;
}
if (process.argv.includes("--stop")) {
  run("pg_ctl", ["-D", data, "-m", "fast", "-t", "10", "stop"]);
  process.exit(0);
}
if (!existsSync(join(data, "PG_VERSION"))) {
  const password = randomBytes(24).toString("hex");
  const pw = join(root, "init-password");
  writeFileSync(pw, password);
  try {
    run("initdb", [
      "-D",
      data,
      "-U",
      "fairshare_admin",
      "--auth=scram-sha-256",
      "--pwfile=" + pw,
      "--encoding=UTF8",
      "--locale=C",
    ]);
  } finally {
    unlinkSync(pw);
  }
  writeFileSync(
    join(root, "admin.env"),
    `DATABASE_URL=postgresql://fairshare_admin:${password}@127.0.0.1:55432/postgres\n`,
  );
}
if (run("pg_ctl", ["-D", data, "status"], false).status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres-phase1.log"),
    "-o",
    "-p 55432 -h 127.0.0.1",
    "-w",
    "-t",
    "10",
    "start",
  ]);
console.log("Owned PostgreSQL cluster ready on 127.0.0.1:55432.");
