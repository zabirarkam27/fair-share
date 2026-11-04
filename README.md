# FairShare — Phase 2

Authentication, responsive application shell, and group management/authorization. Create/list/view groups, invite members with hashed expiring links, and use admin-only removal/deletion. Expense/payment features are **not active**. The earlier implementation is preserved at `reference/pre-phase1/` and Git checkpoint `519735d`; its database was not reset or imported.

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

Migration commands use Prisma `migrate deploy`; they do not reset a database. The initial migration creates User/Session/Account/Verification; the additive Phase 2 migration adds Group/GroupMember/Activity with scoped runtime grants and indexes. Financial entities remain an inactive proposal in `prisma/schema.proposal.prisma`.

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

There is no expense ledger yet. Removal must receive a zero-balance guard before future financial writes are enabled. Leave/reactivation/role-transfer UI and shared invitation throttling are not included in this phase. See the Phase 2 report for security tests and deployment limits.

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
```

Integration tests require a completed production build. They migrate only fairshare_test, start a separately owned Next server on 127.0.0.1:3100 with test runtime credentials, exercise real HTTP authentication/protected routes, then stop that server. They fail on missing/nonallowlisted/shared DB URLs and clean up only their UUID-namespaced accounts. Auth writes really commit; SQLite and outer rollback wrappers do not substitute for this test. Do not run against production. Keep port 3100 available.

The test maintenance role is intentionally able to expire/delete its own test fixtures; the runtime role cannot create schema objects. Test credential isolation and pg_hba checks do not rely merely on different passwords in otherwise identical URLs.

For production serving locally:

```sh
npm run build
npm start
```

Webpack is explicitly selected because this sandbox blocked Turbopack junction creation. System fonts keep builds independent of external font downloads.

## Phase boundary and known limits

Groups and authorization are implemented; balances, expense splitting and settlement flows are not. No deployment, GitHub publication or assessment submission has been performed. Email verification, password recovery and distributed abuse protection are not configured; do not call this production-ready. Better Auth's in-memory HTTP rate limits are not a shared limiter and are not claimed to cover direct Server Action calls.

ESLint 9.39.5 is retained for the declared peer ranges of Next 16.4.5's lint plugins; npm marks that ESLint line unsupported. ESLint 10 executed locally but produced transitive peer conflicts, so it was not left as an unsupported combination. Revisit the lint toolchain together when Next's plugins support it. shadcn is development tooling, not a runtime dependency; its transitive audit advisories are reported in the phase report. Do not apply npm's suggested major downgrade blindly.

See [Phase 2 results](docs/PHASE_2_REPORT.md), [Phase 1 history](docs/PHASE_1_REPORT.md), [architecture](ARCHITECTURE.md), [decisions](DECISIONS.md), [AI usage](AI_LOG.md) and [plan](plan.md). Further phases require explicit approval.
