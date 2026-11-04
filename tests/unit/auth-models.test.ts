import { describe, it, expect } from "vitest";
import { getAuthTables } from "@better-auth/core/db";
import { readFileSync } from "node:fs";
describe("Better Auth / Prisma schema compatibility", () => {
  it("retains every required core auth field alongside the approved group models", () => {
    const authTables = getAuthTables({ emailAndPassword: { enabled: true } });
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const models = [...schema.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)].map(
      (match) => ({
        name: match[1],
        fields: [...match[2].matchAll(/^\s+(\w+)\s+\w/gm)].map((field) => ({
          name: field[1],
        })),
      }),
    );
    expect(models.map((model) => model.name).sort()).toEqual([
      "Account",
      "Activity",
      "Expense",
      "ExpenseSplit",
      "Group",
      "GroupMember",
      "Session",
      "Settlement",
      "User",
      "Verification",
    ]);
    for (const [name, definition] of Object.entries(authTables)) {
      const model = models.find((model) => model.name.toLowerCase() === name);
      expect(model, `Missing auth model ${name}`).toBeDefined();
      const fields = new Set(model!.fields.map((field) => field.name));
      expect(fields.has("id")).toBe(true);
      for (const field of Object.keys(definition.fields))
        expect(fields.has(field), `${name}.${field}`).toBe(true);
    }
  });
});
