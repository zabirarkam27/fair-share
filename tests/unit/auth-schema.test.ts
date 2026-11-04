import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema } from "@/features/auth/schema";
describe("auth payload validation", () => {
  it("normalizes email and trims a bounded display name without changing the password", () => {
    expect(
      signUpSchema.parse({
        name: "  Rafi Ahmed  ",
        email: "Rafi@Example.com",
        password: " a password with spaces ",
      }),
    ).toEqual({
      name: "Rafi Ahmed",
      email: "rafi@example.com",
      password: " a password with spaces ",
    });
  });
  it.each(["short", "", "x".repeat(129)])(
    "rejects invalid signup passwords",
    (password) => {
      expect(
        signUpSchema.safeParse({
          name: "Rafi",
          email: "rafi@example.com",
          password,
        }).success,
      ).toBe(false);
    },
  );
  it("rejects malformed emails, missing names and forged identity fields", () => {
    expect(
      signUpSchema.safeParse({
        name: " ",
        email: "rafi@example.com",
        password: "ValidPassword!2026",
      }).success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({ email: "invalid", password: "password" })
        .success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({
        email: "rafi@example.com",
        password: "password",
        userId: "someone-else",
        role: "admin",
      }).success,
    ).toBe(false);
  });
  it("does not impose new signup minimums on a returning user before Better Auth checks credentials", () => {
    expect(
      signInSchema.safeParse({
        email: "rafi@example.com",
        password: "old-pass",
      }).success,
    ).toBe(true);
  });
});
