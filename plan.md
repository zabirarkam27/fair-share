# FairShare phased plan

Current phase: **0 — architecture proposal, awaiting user approval**.

The pre-existing implementation is a reference baseline. New master instructions supersede its stack/workflow choices. Do not proceed to phase 1 without an explicit approval response.

## Phase 0 — audit and architecture

- [x] Inspect current files, dependencies, schema, service and test boundaries.
- [x] Identify differences from the new stack and workflow.
- [x] Prepare ARCHITECTURE.md, ER diagram, folder/service boundaries and risk register.
- [x] Prepare inactive Prisma schema proposal.
- [x] Write initial DECISIONS.md and project rules.
- [x] Critically review all nine requested areas; select concrete version target, correct membership/remainder/history assumptions and document runtime-verification limits.
- [x] Record current verification accurately: TypeScript + 12 tests pass; earlier build + 42 HTTP assertions pass; latest HTTP regressions not run; ESLint missing.
- [ ] User approves architecture and phase 1.

No database schema was changed and no Prisma dependencies were installed in phase 0.

## Phase 1 — foundation and database/auth migration (after approval)

Review/checkpoint the reference baseline. Pin Next.js 16.4.5, Better Auth 1.7.16 and Prisma CLI/client/adapter-pg 7.10.1 after a security advisory check; pin compatible Tailwind/shadcn, RHF, Vitest and ESLint. Validate the proposal with that CLI, generate/compare Better Auth schema and client, and prove registration/sign-in/sign-out/session cookies using nextCookies and Prisma-adapter transactions. Establish a new target dev DB, isolated test DB and distinct migrate-dev shadow DB. Use non-owner runtime grants and separate migrator/test-maintenance roles. Preserve existing local data; do not overlay/reset the reference Drizzle database. Version changes on compatibility/security failure must be documented before proceeding.

Deliver: Prisma schema/migrations, Better Auth Prisma integration, environment examples, seed data, test/ESLint setup, auth smoke tests, setup README. Gate: typecheck, ESLint, relevant Vitest and auth/database checks; security/diff review; report results and **wait for approval**.

## Phase 2 — money engine and financial model

Port cases to Vitest. Implement BigInt-only parse/format/DTO codecs, four splits with integer shares, zero-sum ledger, settlement/reversal signs and greedy suggestions. Test values beyond Number.MAX_SAFE_INTEGER, one-poisha cases, generated conservation, aggregate text parsing and greedy non-optimality. Test local SQL constraints and application cross-row sum validation; no claim that a CHECK enforces child totals.

Gate: typecheck, ESLint, pure/domain and PostgreSQL tests; review invariants and overflow/serialization; report results and **wait for approval**.

## Phase 3 — groups and permissions

Implement authorized reads/create, admin/member permissions, ACTIVE/LEFT/REMOVED transitions, hashed seven-day invites, rotation/revocation races, zero-balance departure, explicit admin reactivation and soft deletion. Prove a removed user cannot use a generic link to return. Implement the inactive-member zero-financial-delta guard for future expense/payment corrections. Use Server Actions + feature services with shared group-row lock protocol.

Gate: typecheck, ESLint, relevant tests, permission matrix and diff review; **wait for approval**.

## Phase 4 — expenses, settlements and audit

Implement transactional Expense/ExpenseSplit writes for four split types, creation request-key/fingerprint retries and optimistic edit/delete versions. Add locked/idempotent settlements and one full append-only SettlementReversal per payment with reason/actor. Write versioned before/after audit snapshots with actor-name retention and cursor feed. Test FK isolation, role/ownership failures, stale versions, inactive financial deltas, duplicate/conflicting retries, simultaneous payments/reversals, immutable grants and audit-failure rollbacks using independently committed PostgreSQL fixtures.

Gate: typecheck, ESLint, relevant Vitest/DB tests and service security review; **wait for approval**.

## Phase 5 — feature UI

Refactor the dashboard into feature/layout components using Tailwind/shadcn, Lucide, RHF and Zod. Include all required screens, full-reversal confirmation/reason, removed-member reactivation, raw invite reveal at creation only, accurate full-ledger breakdowns, recent activity and responsive loading/error/empty/success states. Paginate lists independently of full-ledger aggregates. Verify keyboard/mobile use and auth cookie persistence. Do not add charts without a useful question.

Gate: typecheck, ESLint, relevant tests, desktop/mobile keyboard/browser walkthrough and diff review; **wait for approval**.

## Phase 6 — final verification and submission preparation

Run complete checks and production build. Check auth, isolation, roles, four splits, balances, suggestions, settlement persistence, history, validation and lifecycle edge cases end to end. Finish README, .env.example, DECISIONS, actual AI_LOG and ~120-word Part C drafts for candidate review. Prepare a <=5-minute demo recording/script with one strength and one limitation. Review secrets and tracked files; make meaningful commits. Publish a public GitHub repo only under the approved publishing scope and available account access. Optional deployment requires PostgreSQL, secrets, trusted HTTPS origin and production migrations. Submission form/receipt deadline require the actual supplied link/time; do not guess them.

Final gate: report exact evidence, limits and missing deliverables. Do not call the assessment complete until critical checks and required submission deliverables are fulfilled. Follow any required final user approval for publication/submission.

## Time and scope

Target focused effort is 8–12 hours, excluding approval waits. Keep one payer, one currency and greedy suggestions. One narrow full-payment reversal is included because immutable wrong payments otherwise cannot be corrected. Defer dark mode, recurring bills, multi-currency, multiple payers, exact optimization, stored balance cache and custom distributed limiter infrastructure. A shared join throttle remains a public-deployment gate. If time tightens, preserve tested core and report omissions. No phase gate passes without actual evidence; pause after each report for approval.
