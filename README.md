# FairShare — Phase 6

Authentication, groups/authorization, four expense split methods, persisted balances, settlement suggestions/recording and protected activity history. Money uses BigInt poisha. Suggestions do not change balances; recorded settlements do. Expense edits/deletion retain immutable old/new snapshots. Reversals remain unimplemented. The reference build remains at `reference/pre-phase1/` and checkpoint `519735d`; its database was not reset or imported.

## Stack

Node 24, Next.js 16.4.5 App Router, React 19.3.1, strict TypeScript, Tailwind 4, shadcn/ui (Radix), Lucide, React Hook Form, Zod, PostgreSQL 18, Prisma CLI/client/adapter-pg 7.10.1 and Better Auth 1.7.16. Vitest and ESLint provide checks. Exact dependency versions are recorded in package.json/package-lock.json. No application starter was used; shadcn's CLI generated the UI primitives.

## Local setup

Install Node 24 and PostgreSQL 18, then:

```sh
npm ci
npm run postgres:local
npm run db:setup-local
npm run db:generate
npm run db:migrate
npm run dev
```

Open [FairShare](http://127.0.0.1:3000). Use this exact origin; localhost and 127.0.0.1 are different cookie origins.

The local helper initializes a cluster under ignored `.local/pgdata`, listening only on 127.0.0.1:55432. On Windows it defaults to `C:/Program Files/PostgreSQL/18/bin`; set PG_BIN for another installation. On macOS/Linux, put PostgreSQL tools on PATH or set PG_BIN. It requires a non-root PostgreSQL-capable account. The helper generates private admin/runtime/migration passwords locally and never prints them. `npm run postgres:stop` stops this owned cluster.

`db:setup-local` verifies that the connected PostgreSQL data directory belongs to this workspace before provisioning anything. It creates new `fairshare_phase1`, `fairshare_test` and `fairshare_shadow` databases with distinct owner/runtime roles. It stores local secrets under ignored `.local/` and writes `.env.local`. Do not delete those credentials while keeping the cluster. The test roles are restricted through scoped pg_hba rules as well as database privileges. This does not change unrelated local PostgreSQL installations.

This Windows sandbox could not reliably retain a background PostgreSQL process. Here the cluster runs in a retained foreground terminal. If the local helper reports startup failure in a similarly restricted environment, run your installed `postgres -D .local/pgdata -p 55432 -h 127.0.0.1` in a separate terminal and retry provisioning. Do not run a second server on an occupied port.

## Existing or hosted PostgreSQL

Copy `.env.example` to `.env.local` and supply real, separately provisioned URLs. The runtime role must not own the schema or have CREATE privileges. The migration owner applies schema changes. Create a separate test database and a separate migrate-dev shadow database; never reuse development/production data. `db:migrate` grants the four auth tables to the documented `fairshare_p1_app` role; the test variant targets `fairshare_p1_test_app`. If your provider assigns other role names, adapt the reviewed grant script to those roles. `db:setup-local` is intentionally for the owned local cluster only, not an arbitrary hosted server.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Restricted application runtime connection |
| DIRECT_URL | Migration-owner connection to development DB |
| SHADOW_DATABASE_URL | Separate shadow DB for Prisma migrate dev; unused by migrate deploy |
| TEST_DATABASE_URL | Restricted runtime connection to allowlisted fairshare_test |
| TEST_MIGRATION_URL | Owner/fixture-maintenance connection to that same isolated test DB |
| BETTER_AUTH_SECRET | Cryptographically random secret, at least 32 characters |
| BETTER_AUTH_URL | Exact trusted origin; local http://127.0.0.1:3000 |

Migration commands use Prisma `migrate deploy`; they do not reset a database. Five migrations cover auth, groups, expenses, settlement storage and settlement audit events. Runtime settlement privileges are SELECT/INSERT only; UPDATE/DELETE/TRUNCATE remain revoked. Reversals in `prisma/schema.proposal.prisma` remain an inactive reference; do not replace the applied schema with that file.

## Authentication and routes

- `/signup` and `/login`: RHF/Zod forms call Server Actions, which validate input again and invoke Better Auth.
- `/api/auth/[...all]`: Better Auth's official handler, retained for its auth protocol.
- `/dashboard`: both page and layout require a verified server session. Identity comes exclusively from that session; only name/email reach the shell.
- `/`: redirects to dashboard or login based on the server session.
- Signout: Better Auth revokes the stored session and clears its HttpOnly cookie, then redirects to login.

Passwords are hashed/verified by Better Auth. No custom password algorithm, session token generation, JWT auth or localStorage credential storage exists. Sessions last seven days, refresh through Better Auth, and use database validation with cookie caching disabled. Auth uses explicit trusted origin, library CSRF protections, and nextCookies last to propagate Server Action cookies.

**UTC adapter requirement:** Prisma pg 7.10.1 can mis-handle timestamptz with a non-UTC connection timezone. The client explicitly sets `options: '-c timezone=UTC'`; keep it. The expired-session integration regression reproduced the failure on the local Dhaka-configured PostgreSQL server and passes with this setting. See [the upstream report](https://github.com/prisma/orm/issues/28629). Confirm your connection provider preserves this startup option before deployment.

## Groups and invitations

`/dashboard` and `/dashboard/groups` list only your own live groups. `/dashboard/groups/[groupId]` independently checks current membership before reading details or members. An admin can issue/replace/revoke an invitation, remove a member, or delete the group with exact-name confirmation. Deletion hides the group and revokes its link while retaining history.

Invites expire in seven days, contain 32 random bytes and are stored only as SHA-256 hashes. Copy the raw link when generated; it cannot be retrieved later. `/join/[token]` provides no private group preview and never joins on GET. Signin/signup returns to the invitation, then acceptance checks it again under a group-row lock. Duplicate joins are idempotent. Removed members cannot return through a generic invitation. No client actor ID or role is trusted.

Removal checks the complete persisted ledger under the group write lock and requires exactly zero net balance. Fully settled and offsetting records can therefore permit removal. Inactive history remains, and later corrections cannot change an inactive member's financial contribution. Leave/reactivation/role-transfer UI and shared invitation throttling remain deferred.

## Expenses and exact splits

Group pages list expenses in pages of 25, show saved allocations and provide add/edit/delete dialogs with live previews. Members may add expenses; the original creator and group admin may edit/delete. Every server operation independently authenticates and checks group membership. An active group payer may be excluded from participants.

Enter BDT as digit strings with at most two decimal places. The server parses them into integer poisha; totals must be ৳0.01–৳1,000,000.00. Exact inputs must sum to the total. Percentages use basis points (50.25% = 5025; total 10000). Share weights are positive integers up to 1,000,000. Largest remainders receive extra poisha; equal remainders use sorted member IDs and a stable expense-ID rotation. New-expense previews disclose that tied recipients can differ by one poisha when saved; edits preserve the ID.

PostgreSQL amounts are BIGINT poisha. Result DTOs/audit snapshots use `amountPoisha` integer strings. `inputUnits` retains exact poisha, basis points or weights; equal splits use null. Creates/splits/audit writes are atomic. Create retries use scoped request keys; edits/deletes require the current version. Deletion retains expenses, splits and history. See [Phase 3 results](docs/PHASE_3_REPORT.md).

## Group balances

Positive balance means owed money, negative means owes, and zero means settled. Each expense credits its payer by the full total and debits included members by their saved allocations. A settlement increases the sender's balance and decreases the receiver's. The balance reader never recomputes splits or accepts monetary/identity values from the client.

Dashboard cards separately total what you owe and what you are owed across active groups; debt in one group is not cancelled against a receivable in another. Group pages show every member's net balance, paid/allocated/sent/received breakdown, per-expense contributions, settlement contributions and exact zero-sum verification. Former members remain in the ledger. Deleted expenses stop contributing, while recorded settlements remain.

All related records are collected within a RepeatableRead transaction. Balances use the entire ledger, not the 25-row expense page. Invalid saved allocations fail visibly as “Balances unavailable”; they do not become fabricated zero balances. Money DTOs use decimal integer strings. No balance cache or manually editable balance column exists. See [Phase 4 results](docs/PHASE_4_REPORT.md) for actual evidence and corrections to the supplied example arithmetic/units.

## Payment suggestions and recording

Group pages suggest same-group debtor-to-creditor payments from the verified full ledger. Viewing suggestions never records a payment or changes balances. An independent check ensures every suggested amount is positive, nonself, within both current amounts and clears the ledger when all suggestions are applied.

For up to 10 nonzero members whose individual balances fit the BDT 1,000,000 payment cap, exact zero-sum partition search finds the minimum payment count. Larger groups or larger individual balances use deterministic largest-debtor/creditor greedy matching, explicitly labelled as not guaranteed minimum. Large obligations are split into recordable capped amounts; plans beyond 1000 payments fail visibly. Exact search is O(3^n) time/O(2^n) space; greedy is O(P n log n) time/O(n+P) space for P payments. See [the Phase 5 report](docs/PHASE_5_REPORT.md) for proof, thresholds and tests.

Sender, receiver or group admin can record an already-completed payment, including a partial amount, with bKash, Cash or Bank labels. The server locks the group, rechecks session membership/authority and current debt/credit, inserts the immutable settlement/audit atomically and recalculates balances. A scoped request key makes retries idempotent; changed payloads under an existing key conflict. This records a user's assertion that money was paid; it does not transfer funds or verify bank/bKash receipts. Distinct keys or people can still make duplicate real-world claims while debt remains; receiver confirmation/disputes and reversals remain future scope.

## Activity history

Use “View activity history” on a group page, or `/dashboard/groups/[groupId]/activity`. Active members can read only their own live groups. The read-only timeline shows actor, action, timestamp in Dhaka time, resource ID and previous/new values. Expense snapshots retain amounts, dates, payer/creator IDs, split methods, versions, original input units and saved allocations; deletion adds an explicit deletion marker while preserving earlier events. Joining/removal captures membership transitions. Settlement recording shares its transaction with the immutable audit insert.

The history uses 25-event keyset pages ordered by timestamp and ID, backed by the existing index. The server rechecks membership and reads each page in a consistent transaction. No activity create/edit/delete endpoint or action is exposed. Runtime roles have SELECT/INSERT on audit storage and cannot UPDATE/DELETE/TRUNCATE it; group admins also have no audit-edit interface.

New snapshots use metadata schema version 2 and explicit per-action allowlists. Legacy version 1 rows remain unchanged and are safely projected on read. Credentials, profile emails, invite tokens/hashes, request keys/fingerprints and UI permission flags are not copied or returned. Malformed/unknown-version metadata is hidden rather than rendered as raw JSON. User-written descriptions and names intentionally remain history; do not put secrets in them. Group soft deletion retains records but disables ordinary group/history access. See [Phase 6 results](docs/PHASE_6_REPORT.md).

## Demo accounts

Local browser demonstrations use `rafi.phase1@example.test` / `FairSharePhase1!2026` (admin of The Dhanmondi flat) and `nusrat.phase2@example.test` / `FairSharePhase2!2026` (member). These are public local demonstration credentials, not production secrets. They are not seeded on a fresh install; use `/signup` to create an account and a group. The old rafi@fairshare.demo account belongs to the archived reference database.

## Checks

```sh
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm run test:migrations
```

Integration tests require a completed production build. They migrate only fairshare_test, start a separately owned Next server on 127.0.0.1:3100 with test runtime credentials, exercise real HTTP authentication/protected routes, then stop that server. They fail on missing/nonallowlisted/shared DB URLs and clean up only their UUID-namespaced accounts. Auth writes really commit; SQLite and outer rollback wrappers do not substitute for this test. Do not run against production. Keep port 3100 available.

The test maintenance role is intentionally able to expire/delete its own test fixtures; the runtime role cannot create schema objects. Test credential isolation and pg_hba checks do not rely merely on different passwords in otherwise identical URLs.

`test:migrations` applies all migrations in a new UUID-named empty schema inside the allowlisted test database, verifies completion, then drops only that generated schema. It never resets public, development or production storage.

For production serving locally:

```sh
npm run build
npm start
```

Webpack is explicitly selected because this sandbox blocked Turbopack junction creation. System fonts keep builds independent of external font downloads.

## Phase boundary and known limits

Phases through activity history/audit logging are implemented. Reversals and further work await approval. All work uses the existing [codex/phase-1-auth](https://github.com/zabirarkam27/fair-share/tree/codex/phase-1-auth) branch. Phases 1–4 are pushed; Phases 5–6 are verified and committed locally, awaiting review before publication. No deployment or assessment submission has occurred. Email verification, password recovery and distributed abuse protection remain unconfigured; this is not production-ready. Better Auth's in-memory HTTP limiter is not shared or claimed to cover direct Server Action calls. Current pg 8 emits the documented Prisma adapter deprecation warning; all checks pass, and pg 9 requires compatibility review.

ESLint 9.39.5 is retained for the declared peer ranges of Next 16.4.5's lint plugins; npm marks that ESLint line unsupported. ESLint 10 executed locally but produced transitive peer conflicts, so it was not left as an unsupported combination. Revisit the lint toolchain together when Next's plugins support it. shadcn is development tooling, not a runtime dependency; its transitive audit advisories are reported in the phase report. Do not apply npm's suggested major downgrade blindly.

See [Phase 6 results](docs/PHASE_6_REPORT.md), [Phase 5 history](docs/PHASE_5_REPORT.md), [Phase 4 history](docs/PHASE_4_REPORT.md), [Phase 3 history](docs/PHASE_3_REPORT.md), [Phase 2 history](docs/PHASE_2_REPORT.md), [Phase 1 history](docs/PHASE_1_REPORT.md), [architecture](ARCHITECTURE.md), [decisions](DECISIONS.md), [AI usage](AI_LOG.md) and [plan](plan.md). Further phases require explicit approval.
