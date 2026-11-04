import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { assertTestDatabase, databaseIdentity } from "../test-database";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:3100";
const email = `phase1-${randomUUID()}@example.test`;
const password = "FairShareIntegration!2026";
let cookie = "";
let userId = "";
let maintenance: Client;
const request = (path: string, body?: unknown, sessionCookie = "") =>
  fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
describe("real Better Auth + Prisma + PostgreSQL + protected Next routes", () => {
  beforeAll(async () => {
    const testUrl = assertTestDatabase(process.env.TEST_DATABASE_URL, [
      process.env.DEV_DATABASE_URL,
    ]);
    if (
      !process.env.TEST_MIGRATION_URL ||
      databaseIdentity(testUrl) !==
        databaseIdentity(process.env.TEST_MIGRATION_URL)
    )
      throw new Error("Test maintenance role must target the test database.");
    maintenance = new Client({
      connectionString: process.env.TEST_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    });
    await maintenance.connect();
  });
  afterAll(async () => {
    if (maintenance) {
      if (userId)
        await maintenance.query('DELETE FROM "user" WHERE id=$1 AND email=$2', [
          userId,
          email,
        ]);
      await maintenance.end();
    }
  });
  it("redirects anonymous dashboard and root requests", async () => {
    for (const path of ["/dashboard", "/"]) {
      const response = await request(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/login");
    }
  });
  it("does not treat a forged cookie as authentication", async () => {
    const response = await request(
      "/dashboard",
      undefined,
      "better-auth.session_token=forged",
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login");
  });
  it("registers a new user and returns a persistent HttpOnly session cookie", async () => {
    const response = await request("/api/auth/sign-up/email", {
      name: "Integration Rafi",
      email,
      password,
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    userId = data.user.id;
    expect(userId).toBeTruthy();
    expect(data.user.email).toBe(email);
    const raw = response.headers.getSetCookie().join(";");
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Max-Age=/i);
    cookie = cookies(response);
    expect(cookie).toContain("session_token=");
  });
  it("persists library-hashed credentials and sessions in the migrated PostgreSQL tables", async () => {
    const result = await maintenance.query(
      'SELECT a.password,s.token FROM account a JOIN session s ON s."userId"=a."userId" WHERE a."userId"=$1',
      [userId],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].password).not.toBe(password);
    expect(result.rows[0].password.length).toBeGreaterThan(20);
    expect(result.rows[0].token).toBeTruthy();
  });
  it("persists identity across requests and renders only the server-derived account", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(
        "/api/auth/get-session",
        undefined,
        cookie,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.id).toBe(userId);
    }
    const dashboard = await request("/dashboard", undefined, cookie);
    expect(dashboard.status).toBe(200);
    const html = await dashboard.text();
    expect(html).toContain("Integration Rafi");
    expect(html).toContain(email);
    expect(html).not.toContain("rafi@fairshare.demo");
  });
  it("redirects authenticated visitors away from login/signup", async () => {
    for (const path of ["/login", "/signup"]) {
      const response = await request(path, undefined, cookie);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/dashboard");
    }
  });
  it("rejects incorrect credentials without creating a session", async () => {
    const response = await request("/api/auth/sign-in/email", {
      email,
      password: "IncorrectPassword!",
    });
    expect(response.status).toBe(401);
    expect(cookies(response)).not.toContain("session_token=");
  });
  it("rejects malformed and weak signup requests on the server", async () => {
    const bad = await request("/api/auth/sign-up/email", {
      name: "Test",
      email: "invalid-email",
      password: "short",
    });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });
  it("rejects untrusted mutation origins", async () => {
    const response = await fetch(base + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: "{}",
    });
    expect(response.status).toBe(403);
  });
  it("signs out, invalidates the old server session and denies the dashboard", async () => {
    const response = await request("/api/auth/sign-out", {}, cookie);
    expect(response.status).toBe(200);
    const session = await request("/api/auth/get-session", undefined, cookie);
    expect(await session.json()).toBeNull();
    const dashboard = await request("/dashboard", undefined, cookie);
    expect(dashboard.status).toBe(307);
  });
  it("signs in with the registered credentials", async () => {
    const response = await request("/api/auth/sign-in/email", {
      email,
      password,
    });
    expect(response.status).toBe(200);
    cookie = cookies(response);
    expect((await response.json()).user.id).toBe(userId);
  });
  it("rejects expired sessions and checks the database on subsequent requests", async () => {
    const changed = await maintenance.query(
      'UPDATE session SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1 RETURNING "expiresAt"',
      [userId],
    );
    expect(changed.rowCount).toBe(1);
    const response = await request("/dashboard", undefined, cookie);
    const html = await response.text();
    if (response.status === 200) {
      expect(/<meta[^>]*http-equiv="refresh"[^>]*url=\/login/.test(html)).toBe(
        true,
      );
      expect(html).not.toContain(email);
      expect(html).not.toContain("Hey Integration");
    } else {
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/login");
    }
    expect(
      await (await request("/api/auth/get-session", undefined, cookie)).json(),
    ).toBeNull();
  });
  it("uses a restricted runtime database role without schema creation privileges", async () => {
    const runtime = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await runtime.connect();
    try {
      const result = await runtime.query(
        "SELECT current_database() db, has_schema_privilege(current_user,'public','CREATE') can_create",
      );
      expect(result.rows[0].db).toBe("fairshare_test");
      expect(result.rows[0].can_create).toBe(false);
    } finally {
      await runtime.end();
    }
  });
  it("does not expose reference group management routes", async () => {
    expect(
      (await request("/groups/demo-dhanmondi", undefined, cookie)).status,
    ).toBe(404);
    expect((await request("/api/data/groups", {}, cookie)).status).toBe(404);
  });
});
