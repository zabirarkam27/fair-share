# FairShare approval-gated plan

Current status: **Complete quality review after Phase 7; core automated checks verified, candidate-only submission requirements remain pending.** Work stays on `codex/phase-1-auth`. No product feature, migration, dependency upgrade, deployment, push or submission is authorized by this review. Do not declare the assessment complete. Evidence: docs/QUALITY_REVIEW.md.

## Current Git audit and approval gate

The user subsequently requested a history audit and a stricter commit workflow. GitHub's default/intended main branch is `codex/phase-1-auth`, not local `master`. The pre-amend audit snapshot contains 19 linear commits: 11 published through `8f24e2c`, followed by eight local commits through `86dac2f`. All approved phases and quality work are on the intended branch in dependency order; local `master` remains the preserved `519735d` checkpoint. The user then approved final documentation cleanup and the final commit, applying the latest-only amendment proposal; no other branch/history change is authorized.

Going forward: finish one approved phase, run its required tests, review the diff, present a short Conventional Commit message, wait for explicit approval, create one meaningful commit including relevant docs, and push the verified phase. Obtain approval before the next phase. Avoid empty commits and repeated verification/publication documentation commits. Do not force-push, reset branches, delete commits or rewrite published history. Only the latest unpushed commit may be amended when appropriate, after approval of the concrete proposal; older commits remain unchanged unless explicitly authorized.

The audit found no duplicate patch IDs or empty reachable commits. Several documentation titles are repetitive/long, and the published consolidation-note commit describes an earlier branch operation rather than performing one. Preserve these published commits. The approved final documentation amendment uses `docs: update project documentation`, incorporates these workflow updates, confirms the five required files and replaces misleading legacy demo-login guidance with the verified seed accounts. The amended tip's hash is reported by Git after commit; the audit artifact remains a historical pre-amend snapshot. No push is included. Detailed per-commit findings are saved locally in ignored `artifacts/GIT_AUDIT.md`; they do not require another standalone documentation commit.

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
- [x] User approved Phase 6 activity history and audit logging only; publication remains separate.

## Phase 6 — completed approved scope

- [x] All seven required event categories include group/actor/action/resource/timestamp and applicable snapshots.
- [x] Central server-only metadata allowlists; versioned new snapshots and safe legacy projection.
- [x] Complete old/new expense values and allocations survive three edits plus deletion.
- [x] Membership before/after transitions and explicit deletion markers.
- [x] Current-membership-authorized history route with consistent reads and stable 25-row keyset pages.
- [x] Runtime audit immutability, no activity mutation endpoint, atomic domain/audit rollback.
- [x] 110 unit tests, 123 PostgreSQL integration tests, TypeScript, ESLint, build and five clean-schema migrations pass.
- [x] Browser confirms 100→200 and 200→300 snapshots remain after deletion; mobile layout contained.
- [x] User approved Phase 7 dashboard/interface implementation only; publication remains separate.

## Phase 7 — completed approved scope

- [x] All 13 requested screens connected to real existing features.
- [x] Dashboard owed/receivable totals, individual group balances, recent authorized activity and quick actions.
- [x] Focused expense list/add/edit/detail, balances, settlement suggestions/history and settings routes.
- [x] Equal/exact/percentage/shares inputs with read-only server preview; no browser financial engines.
- [x] Saved allocations, session identity, membership/creator/admin boundaries and edit versions remain authoritative.
- [x] Responsive desktop/mobile navigation, labelled controls, focus, loading/error/success/empty states and destructive confirmations.
- [x] 110 unit tests, 137 PostgreSQL integration tests (14 new interface cases), TypeScript, zero-warning ESLint, production build and five clean-schema migrations pass.
- [x] Browser all-method previews, percentage error, weighted save/exact edit, partial payment/history, invitation entry and mobile containment verified.
- [x] Two disposable browser accounts/group and temporary server cleaned up; normal local app restored.
- [x] User authorized a complete quality review, documentation and local demo seed only; publication remains separate.

## Quality review — current gate

- [x] Re-read the original assessment and master instructions; separate implemented requirements from proposals and candidate-only deliverables.
- [x] TypeScript, zero-warning ESLint, 110 unit tests, 138 integration tests, production build and Prisma validation pass.
- [x] Five migrations pass from an empty isolated test schema; read-only Prisma schema diff reports no difference.
- [x] Financial/property, authorization, isolation, transaction, audit, invite, retry and inactive-history checks reviewed.
- [x] Query-budget regression: expense list 8 SELECTs for 1/25 expenses; overview 7 SELECTs for 1/8 groups, excluding the separate auth client.
- [x] Current secret values absent from 56 browser-build files and 187 tracked files at scan time; no NEXT_PUBLIC_ environment settings.
- [x] npm production audit 0 advisories; full tooling audit retains 19 moderate/2 low package entries, no high/critical.
- [x] Guarded local demo seed creates/verifies four Better Auth users, two groups, five expenses, four settlements, retained edit history and exact zero sums. Second run reuses records.
- [x] README, environment example, six A4 decisions, AI evidence, Part C drafts and requirement-by-requirement checklist updated.
- [ ] Candidate reviews/rewrites Part C in their own words and confirms a specific independently written contribution/reason. Current claim of writing most of the project is a self-report, not file-level verification.
- [ ] Candidate records the required <=5-minute walkthrough and confirms receipt/submission deadline.
- [ ] Explicit approval for publishing current local commits and/or deployment/submission; no live URL is claimed.

The first integration attempt in this review had a Windows worker crash (108 tests passed; remaining settlement cases incomplete). A full retry passed 137, and the expanded suite passed 138. The crash was not suppressed or represented as a pass; its root cause remains unverified. The 40-member/5,000-expense latency scenario and hosted HTTPS/backup/restore operation have not been benchmarked or verified.

## Future work — proposals, not authorization

Reversals, recipient confirmation/disputes and later features need separate approval. Reversal writers must share the group lock, preserve inactive-member deltas and commit immutable correction/audit records atomically. All approved work remains on the original branch; the redundant Phase 4 branch was removed after its history was safely consolidated and pushed.

The full Prisma proposal is an entity design reference, not a file to copy over the applied schema. Retain active table mappings and migration history while adding explicitly approved entities. Shared invitation throttling, log redaction, recovery/verification, retention and operational hardening remain deployment gates.

Every future phase must end with TypeScript, ESLint, relevant real tests, security/diff review and a concise report, then wait for approval. Final submission work includes complete checks, candidate-reviewed personal answers/AI log, a <=5-minute recording, secret review, meaningful commits and only approved publication/submission. Do not claim the entire assessment complete from an individual phase gate.
