# FairShare approval-gated plan

Current status: **Phase 2 — Group Management and Authorization implemented and verified; awaiting explicit approval before further work.** The user's latest scope supersedes the earlier plan's numbering. No financial implementation is authorized by this completion.

## Completed foundations

- Phase 0: repository audit, architecture/security/financial proposals and decisions. Initial build preserved at reference/pre-phase1 and Git checkpoint 519735d.
- Phase 1: Next.js/TypeScript, Tailwind/shadcn, Prisma/PostgreSQL auth migration, restricted dev/test roles, Better Auth Server Actions/sessions and protected responsive shell. Report: docs/PHASE_1_REPORT.md.

## Phase 2 — approved group scope

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
- [ ] User reviews Phase 2 report and explicitly authorizes any next scope.

See docs/PHASE_2_REPORT.md for actual evidence, fixture-rate-limit failures/correction and limits. Group operations are implemented; expense/balance/settlement code is not active. Leave, admin transfer and reactivation UI are not part of the requested features.

## Future work — proposals, not authorization

If approved, the next financial scope needs pure BigInt poisha codecs, four exact split methods, persisted allocations, ledger invariants and deterministic settlement suggestions, followed by transactional expense/payment/audit services and their UI. Before permitting any financial writes, integrate zero-net-balance checks into member removal and inactive-member delta guards into historical corrections. Do not leave today's group-only removal assumption in a future ledger-enabled app.

The full Prisma proposal is an entity design reference, not a file to copy over the applied schema. Retain active table mappings and migration history while adding explicitly approved entities. Shared invitation throttling, log redaction, recovery/verification, retention and operational hardening remain deployment gates.

Every future phase must end with TypeScript, ESLint, relevant real tests, security/diff review and a concise report, then wait for approval. Final submission work includes complete checks, candidate-reviewed personal answers/AI log, a <=5-minute recording, secret review, meaningful commits and only approved publication/submission. Do not claim the entire assessment complete from an individual phase gate.
