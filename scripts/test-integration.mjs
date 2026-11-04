import { config } from "dotenv";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertTestDatabase,
  databaseIdentity,
} from "../tests/test-database.ts";
config({ path: ".env.local", quiet: true });
const url = assertTestDatabase(process.env.TEST_DATABASE_URL, [
  process.env.DATABASE_URL,
  process.env.PRODUCTION_DATABASE_URL,
]);
if (
  !process.env.TEST_MIGRATION_URL ||
  databaseIdentity(url) !== databaseIdentity(process.env.TEST_MIGRATION_URL)
)
  throw new Error("Test maintenance role must target the same test database.");
const env = {
  ...process.env,
  DEV_DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL: url,
  BETTER_AUTH_URL: "http://127.0.0.1:3100",
  TEST_APP_URL: "http://127.0.0.1:3100",
  NEXT_TELEMETRY_DISABLED: "1",
};
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "-p",
    "3100",
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output += String(chunk);
});
server.stderr.on("data", (chunk) => {
  output += String(chunk);
});
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null)
      throw new Error("Test server exited: " + output.slice(-2000));
    try {
      if (!output.includes("Ready in")) {
        await delay(200);
        continue;
      }
      const response = await fetch(env.TEST_APP_URL + "/login", {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  if (!ready)
    throw new Error("Test server did not become ready: " + output.slice(-2000));
  const test = spawn(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vitest.integration.config.ts",
    ],
    { env, windowsHide: true, stdio: "inherit" },
  );
  const code = await new Promise((resolve, reject) => {
    test.on("error", reject);
    test.on("exit", resolve);
  });
  if (code !== 0) {
    console.error(output.slice(-3000));
    process.exitCode = Number(code) || 1;
  }
} finally {
  server.kill();
}
