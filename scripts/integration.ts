import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/lib/db";
const base = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const stamp = Date.now();
const users: { id: string; cookie: string }[] = [];
const groupIds: string[] = [];
let checks = 0;
type ResponseData = Record<string, any>; // Test harness checks untrusted JSON explicitly.
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  person = 0,
  expected = 200,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: users[person]?.cookie ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as ResponseData;
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return data;
}
try {
  await request("/api/data", "GET", undefined, 0, 401);
  for (let n = 0; n < 3; n++) {
    const response = await fetch(base + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test member " + n,
        email: `integration-${stamp}-${n}@example.test`,
        password: "IntegrationPassword!2026",
      }),
    });
    const data = (await response.json()) as ResponseData;
    assert.equal(response.status, 200, JSON.stringify(data));
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    assert.ok(cookie);
    users.push({ id: data.user.id, cookie });
  }
  const group = await request("/api/data/groups", "POST", {
    name: "Integration group",
    description: "Disposable automated verification",
  });
  groupIds.push(group.id);
  const other = await request(
    "/api/data/groups",
    "POST",
    { name: "Private group" },
    2,
  );
  groupIds.push(other.id);
  await request("/api/data/groups/" + group.id, "GET", undefined, 1, 404);
  await request(
    "/api/data/groups/" + group.id + "/expenses",
    "POST",
    {},
    1,
    400,
  ); // malformed input rejected before membership; no data disclosed
  const detail = await request("/api/data/groups/" + group.id);
  await request("/api/data/join", "POST", { token: detail.inviteToken }, 1);
  const path = "/api/data/groups/" + group.id;
  const bill = {
    description: "One hundred split three ways",
    amount: "100",
    date: "2026-11-04",
    paidBy: users[0].id,
    splitType: "equal",
    inputs: users.slice(0, 2).map((u) => ({ userId: u.id, value: "1" })),
  };
  await request(
    path + "/expenses",
    "POST",
    { ...bill, paidBy: users[2].id },
    0,
    400,
  );
  await request(
    path + "/expenses",
    "POST",
    { ...bill, inputs: [...bill.inputs, bill.inputs[0]] },
    0,
    400,
  );
  await request(
    path + "/expenses",
    "POST",
    {
      ...bill,
      splitType: "exact",
      inputs: bill.inputs.map((i) => ({ ...i, value: "49.99" })),
    },
    0,
    400,
  );
  await request(
    path + "/expenses",
    "POST",
    {
      ...bill,
      splitType: "percentage",
      inputs: bill.inputs.map((i) => ({ ...i, value: "49.99" })),
    },
    0,
    400,
  );
  await request(path + "/expenses", "POST", { ...bill, amount: "-1" }, 0, 400);
  await request(
    path + "/expenses",
    "POST",
    { ...bill, date: "2026-02-30" },
    0,
    400,
  );
  const created = await request(path + "/expenses", "POST", bill, 1);
  await request(
    "/api/data/groups/" + other.id + "/expenses/" + created.id,
    "PUT",
    { ...bill, version: 1 },
    2,
    404,
  );
  await request(
    path + "/expenses/" + created.id,
    "PUT",
    { ...bill, version: 1 },
    2,
    404,
  );
  // Second member authors a bill; admin can edit. Optimistic versions reject stale writes.
  await request(path + "/expenses/" + created.id, "PUT", {
    ...bill,
    description: "Admin edit",
    version: 1,
  });
  await request(
    path + "/expenses/" + created.id,
    "PUT",
    { ...bill, version: 1 },
    1,
    409,
  );
  const thirdBill = await request(path + "/expenses", "POST", {
    ...bill,
    description: "Admin-owned expense",
  });
  await request(
    path + "/expenses/" + thirdBill.id,
    "DELETE",
    { version: 1 },
    1,
    403,
  );
  await request(path + "/expenses/" + thirdBill.id, "DELETE", { version: 1 });
  const d = await request(path);
  assert.equal(
    Object.values(d.balances).reduce((s: number, v) => s + Number(v), 0),
    0,
  );
  assert.ok(
    d.activity.some(
      (a: ResponseData) =>
        a.action === "edited expense" &&
        a.before.description === bill.description &&
        a.after.description === "Admin edit",
    ),
  );
  checks += 2;
  await request(path + "/members/" + users[1].id, "DELETE", {}, 0, 409);
  await request(path, "DELETE", { name: "Integration group" }, 1, 403);
  const payment = {
    fromId: users[1].id,
    toId: users[0].id,
    amount: "50",
    method: "bKash",
    requestId: randomUUID(),
  };
  const simultaneous = await Promise.all([
    request(path + "/settlements", "POST", payment, 1),
    request(path + "/settlements", "POST", payment, 1),
  ]);
  assert.equal(simultaneous[0].id, simultaneous[1].id);
  checks++;
  await request(
    path + "/settlements",
    "POST",
    { ...payment, requestId: randomUUID() },
    1,
    409,
  );
  const paid = await request(path);
  assert.equal(paid.settlements.length, 1);
  assert.ok(Object.values(paid.balances).every((v) => v === 0));
  checks += 2;
  await request(path + "/members/" + users[1].id, "DELETE", {});
  await request(path + '/expenses/' + created.id, 'DELETE', {version:2},0,409);
  await request(path + '/expenses/' + created.id, 'PUT', {...bill,version:2,inputs:[bill.inputs[0]]},0,409);
  await request(path, "GET", undefined, 1, 404);
  await request(path + "/expenses", "POST", bill, 1, 404);
  const oldToken = detail.inviteToken;
  await request(path + "/invite", "POST", {});
  await request("/api/data/join", "POST", { token: oldToken }, 1, 404);
  const forged = await fetch(base + path + "/invite", {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
      Cookie: users[0].cookie,
    },
    body: "{}",
  });
  assert.equal(forged.status, 403);
  checks++;
  await request(path, "DELETE", { name: "wrong name" }, 0, 400);
  await request(path, "DELETE", { name: "Integration group" });
  await request(path, "GET", undefined, 0, 404);
  console.log(
    `PASS: ${checks} HTTP/integration assertions; real Better Auth sessions and PostgreSQL.`,
  );
} finally {
  for (const id of groupIds)
    await pool.query("DELETE FROM groups WHERE id=$1", [id]);
  for (const u of users)
    await pool.query('DELETE FROM "user" WHERE id=$1', [u.id]);
  await pool.end();
}
