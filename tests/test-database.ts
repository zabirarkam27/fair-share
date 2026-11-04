export function databaseIdentity(value: string) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Only PostgreSQL test URLs are supported.");
  const host = url.hostname.toLowerCase().replace(/^localhost$/, "127.0.0.1");
  return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function assertTestDatabase(
  testURL: string | undefined,
  developmentURLs: (string | undefined)[],
) {
  if (!testURL) throw new Error("TEST_DATABASE_URL must be set explicitly.");
  const url = new URL(testURL);
  if (decodeURIComponent(url.pathname.slice(1)) !== "fairshare_test")
    throw new Error(
      "Refusing tests outside the allowlisted fairshare_test database.",
    );
  const identity = databaseIdentity(testURL);
  if (
    developmentURLs.some(
      (value) => value && databaseIdentity(value) === identity,
    )
  )
    throw new Error("Test database must differ from development/production.");
  return testURL;
}
