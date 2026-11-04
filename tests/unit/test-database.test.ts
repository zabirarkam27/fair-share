import { describe, it, expect } from "vitest";
import { assertTestDatabase, databaseIdentity } from "../test-database";
describe("test database safety", () => {
  it("requires an explicit allowlisted database", () => {
    expect(() => assertTestDatabase(undefined, [])).toThrow();
    expect(() =>
      assertTestDatabase("postgres://u:p@127.0.0.1/fairshare_phase1", []),
    ).toThrow();
  });
  it("does not mistake credentials or localhost/default port spelling for isolation", () => {
    expect(databaseIdentity("postgres://a:a@localhost/fairshare_test")).toBe(
      databaseIdentity("postgresql://b:b@127.0.0.1:5432/fairshare_test"),
    );
    expect(() =>
      assertTestDatabase("postgres://a:a@localhost/fairshare_test", [
        "postgres://b:b@127.0.0.1:5432/fairshare_test",
      ]),
    ).toThrow();
  });
  it("accepts a separately configured test database", () => {
    const test = "postgres://test:p@127.0.0.1:55432/fairshare_test";
    expect(
      assertTestDatabase(test, [
        "postgres://dev:p@127.0.0.1:55432/fairshare_phase1",
      ]),
    ).toBe(test);
  });
});
