# FairShare approval-gated plan

Current status: **Phase 3 — Expense Management and Financial Split Engine implemented and verified; awaiting explicit approval.** The user's numbering supersedes the original sequence. Balances and settlements were not started.

## Completed foundations

- Phase 0: repository audit, architecture/security/financial proposals and decisions. Initial build preserved at reference/pre-phase1 and Git checkpoint 519735d.
- Phase 1: Next.js/TypeScript, Tailwind/shadcn, Prisma/PostgreSQL auth migration, restricted dev/test roles, Better Auth Server Actions/sessions and protected responsive shell. Report: docs/PHASE_1_REPORT.md.

## Phase 2 — completed group scope

- [x] Create group + creator ADMIN + audit in one transaction.
- [x] List only the verified user's active groups.
- [x] Independently authorize group details and member roster reads.
- [x] Issue cryptographically random, hashed, seven-day invitations; rotate/revoke.
- [x] Preserve invitation through signin/signup, then explicitly accept.
- [x] Prevent duplicate memberships and concurrent duplicate join events.
- [x] Admin-only removal; retain REMOVED membership and deny link-based rejoin.
- [x] Admin-only exact-name-confirmed soft deletion + invitation revocation + history.
- [x] Apply additive migration and scoped grants to dev/test DBs.
- [x] Verify the eight requested tests plus related lifecycle, rollback, race and auth regressions.
- [x] TypeScript, zero-warning ESLint, 17 unit tests, 34 PostgreSQL integration tests and production build pass.
- [x] Browser create/invite/signup-return/join/member-view flow verified.
- [x] User approved Phase 3 expense management and split engine only.

See docs/PHASE_2_REPORT.md for historical evidence. Leave, admin transfer and reactivation UI remain deferred.

## Phase 3 — completed approved scope

- [x] Pure BigInt money codecs and equal/exact/percentage/shares engine first.
- [x] Critical 42-test engine suite passed before persistence/UI implementation.
- [x] Integer basis points/weights, largest remainders and stable rotating ties.
- [x] Additive expense/split migration with composite group FKs and amount checks.
- [x] Authenticated server membership/payer/participant validation; creator/admin edit/delete boundaries.
- [x] Group lock, atomic expense/split/audit writes, request keys, versions and soft deletion.
- [x] Conservative involvement removal guard and inactive-history correction guards.
- [x] Responsive RHF/Zod form, saved splits, previews and paginated lists.
- [x] 60 unit tests, 59 PostgreSQL integration tests, TypeScript, ESLint and production build pass.
- [x] All 3 migrations succeed from a new empty isolated PostgreSQL schema.
- [x] Browser all-method save/edit/delete, precision rejection, excluded payer and mobile form verified on isolated test origin.
- [ ] User reviews docs/PHASE_3_REPORT.md and explicitly approves further work.

## Future work — proposals, not authorization

Balances, settlement suggestions, recorded payments and reversals need separate approval. They must use all saved allocations, exact BigInt aggregates, reviewed sign conventions, consistent snapshots, invariant tests and full-ledger removal guards. Never derive balances from a paginated expense list. The current removal guard deliberately blocks any live payer/positive-allocation involvement until that phase is approved.

The full Prisma proposal is an entity design reference, not a file to copy over the applied schema. Retain active table mappings and migration history while adding explicitly approved entities. Shared invitation throttling, log redaction, recovery/verification, retention and operational hardening remain deployment gates.

Every future phase must end with TypeScript, ESLint, relevant real tests, security/diff review and a concise report, then wait for approval. Final submission work includes complete checks, candidate-reviewed personal answers/AI log, a <=5-minute recording, secret review, meaningful commits and only approved publication/submission. Do not claim the entire assessment complete from an individual phase gate.
