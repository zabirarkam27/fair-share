# FairShare approval-gated plan

Current status: **Phase 5 — Settlement Suggestions and Recording implemented and verified; awaiting explicit approval.** Work remains on `codex/phase-1-auth`; Phase 5 is committed locally and not pushed. Reversals and later phases remain unimplemented.

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
- [x] User approved Phase 4 group balance calculation only.

## Phase 4 — completed approved scope

- [x] Pure BigInt balance engine: payer credits, allocated-share debits, sender increases and receiver decreases.
- [x] Validate persisted records and exact expense/group zero sums; fail visibly on corruption.
- [x] Authorized complete-ledger reads in RepeatableRead transactions; no client financial/actor values.
- [x] Group/member net balances, current-user owed/receivable totals, detailed and per-expense/settlement contributions.
- [x] Minimal settlement storage migration; runtime SELECT only, no recording action/API/UI.
- [x] Full-ledger zero-balance member removal and retained inactive-history guards.
- [x] Dashboard/group display, mobile table overflow containment and verified failure state.
- [x] Required scenarios, including separately documented corrections to scenarios 1 and 2.
- [x] 89 unit tests, 79 PostgreSQL integration tests, TypeScript, ESLint, production build and all four clean-schema migrations pass.
- [x] Browser shows +600/−600 BDT and exact zero after a persisted 400 BDT settlement against a 1000 BDT expense.
- [x] User approved Phase 5 settlement suggestions and recording only.

## Phase 5 — completed approved scope

- [x] Pure deterministic greedy and bounded exact planners with independent complete-plan verification.
- [x] Exact optimization <=10 nonzero members within per-payment cap; truthful greedy fallback and complexity labels.
- [x] Read-only suggestions from persisted full-group balances, never client monetary values.
- [x] Partial/full completed payment recording with bKash/Cash/Bank labels.
- [x] Session-derived sender/receiver/admin authority, same-group active members, locked current debt/credit limits.
- [x] Atomic append-only settlement/audit, scoped idempotency and balance recalculation.
- [x] Required cases plus concurrent duplicate/overpayment, stale-plan, removal-race, immutability and rollback tests.
- [x] 104 unit tests, 108 PostgreSQL integration tests, TypeScript, ESLint, production build and all five clean-schema migrations pass.
- [x] Exact planner matches independent exhaustive search on 27 tiny ledgers; 1000 generated cases verify cleared balances.
- [x] Browser partial 200 BDT and remaining 400 BDT recordings reduce 600→400→0; history labels and responsive form verified.
- [ ] User reviews docs/PHASE_5_REPORT.md and explicitly approves further work/publication.

## Future work — proposals, not authorization

Reversals, recipient confirmation/disputes and later features need separate approval. Reversal writers must share the group lock, preserve inactive-member deltas and commit immutable correction/audit records atomically. All approved work remains on the original branch; the redundant Phase 4 branch was removed after its history was safely consolidated and pushed.

The full Prisma proposal is an entity design reference, not a file to copy over the applied schema. Retain active table mappings and migration history while adding explicitly approved entities. Shared invitation throttling, log redaction, recovery/verification, retention and operational hardening remain deployment gates.

Every future phase must end with TypeScript, ESLint, relevant real tests, security/diff review and a concise report, then wait for approval. Final submission work includes complete checks, candidate-reviewed personal answers/AI log, a <=5-minute recording, secret review, meaningful commits and only approved publication/submission. Do not claim the entire assessment complete from an individual phase gate.
