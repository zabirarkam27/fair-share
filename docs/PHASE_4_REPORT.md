# Phase 4 — Group Balance Calculation

Implemented under the user's explicit Phase 4 approval on 4 November 2026 (Asia/Dhaka). Implementation commit: `c80d6ab`, now on the original default branch [codex/phase-1-auth](https://github.com/zabirarkam27/fair-share/tree/codex/phase-1-auth). Subsequently pushed after explicit publication approval and consolidated by fast-forward at the user's single-branch request. No settlement suggestions, settlement-recording workflow, reversals or deployment were implemented in Phase 4.

## Actual verification

| Check | Result |
| --- | --- |
| Pure balance engine before integration/UI | 29 tests passed |
| Final unit suite | 89 passed in 7 files (29 balance + 60 retained) |
| Real PostgreSQL integration suite | 79 passed in 4 files (20 balance + 59 retained) |
| TypeScript | Passed (`npm run typecheck`) |
| ESLint | Passed, zero warnings (`npm run lint`) |
| Production build | Passed (`npm run build`, Webpack) |
| Prisma | Schema validated and client generated |
| Dev/test migrations | Additive settlement-read migration applied successfully |
| Clean-schema migrations | All 4 applied in a new isolated schema (`npm run test:migrations`) |
| Browser | Dashboard totals, member breakdown, expense/payment contributions and mobile containment verified |

The pure tests include 1,000 deterministic generated ledgers, checking exact zero group total, zero-sum contributions per record and each member's reconciliation equation. These generated assertions are part of one Vitest test, not 1,000 separately reported tests. Every successful scenario verifies exactly zero poisha; malformed ledgers are rejected before a verified result can be returned. Integration output is retained locally in ignored artifacts/phase4-integration.log.

## Supplied example conflicts and actual outcomes

The formula and persisted records are authoritative. Two examples conflict with their stated expected values; both interpretations are explicitly covered rather than introducing exceptions into accounting.

| Scenario | Persisted records | Verified result |
| --- | --- | --- |
| 1, literal wording | A pays BDT 4000; B/C allocated BDT 2000 each | A +4000, B −2000, C −2000 BDT |
| 1, supplied expected result | A pays BDT 4000; A/B allocated BDT 2000 each, C zero | A +2000, B −2000, C 0 BDT |
| 2, stated BDT amount | A pays BDT 1000; saved allocations 33333/33333/33334 poisha | A +66667, B −33333, C −33334 poisha |
| 2, supplied poisha expectations | A pays BDT 100; saved allocations 3333/3333/3334 poisha | A +6667, B −3333, C −3334 poisha |
| 3 | A pays BDT 2000 exclusively for B | A +2000, B −2000 BDT |
| 4 | A pays BDT 1000 for B; B settles BDT 400 to A | A +600, B −600 BDT |
| 5 | Edit the old BDT 1000 expense to BDT 2000 for B, retaining the BDT 400 settlement | A +1600, B −1600 BDT |

Scenario 2's integration test also creates a true EQUAL expense and verifies balances against its actual saved rounding recipient. The balance engine never redistributes rounding or recomputes a split. Every row above totals exactly zero.

## Accounting and outputs

`src/features/balances/engine.ts` is pure and independent of Next.js, sessions and the database. All amounts, sums and contributions are BigInt poisha. Positive net means owed money, negative means owes, zero means settled.

For each expense, payer credit = full saved amount; each included member's debit = saved allocation. For settlements, sender receives a positive balance contribution and receiver a negative one. Each member reconciles as:

`net = paid − allocated + sent − received`

The engine returns all member nets and category totals, per-expense paid/allocated/net contributions, settlement contributions, total expenses/settlements and exact group zero-sum verification. It rejects invalid/non-BigInt amounts, negative or missing/mismatched/duplicate allocations, unknown members, cross-group records, duplicate record IDs, nonpositive settlements and self-payments. Saved expense amounts respect the existing 100000000-poisha per-record cap; aggregate totals remain BigInt.

`currentUserBalance` returns net, amount owed by the member and amount owed to the member. The server overview adds each group's debt and receivable separately, so money owed in one group cannot cancel a receivable in another. All money crossing DTO boundaries uses explicit decimal integer poisha strings; no global BigInt JSON override exists.

## Persisted data and security

The server reader accepts only a strictly validated group ID and resolves actor identity through Better Auth. Every group detail read independently checks active membership and live group status. Overview group IDs come from the current user's active memberships. Client-provided balances, allocations, settlement records or user IDs are rejected; there is no public balance mutation action.

Members, complete live expenses/splits and all recorded settlements are collected inside one RepeatableRead transaction, with finite wait/time limits. Former members remain in the ledger. Expense display pagination does not limit balance input. Soft-deleted expenses are excluded; settlements remain authoritative after an edit/delete, so corrections can legitimately reverse who owes whom. Results are recalculated rather than cached or manually stored.

The internal ledger reader is server-only and shared with the member-removal transaction. It receives trusted scopes after authorization and is not exported as a Server Action. Removal uses the existing group lock and requires the member's full-ledger net to equal zero. This allows fully settled or offsetting records to permit removal. Existing expense edit/delete guards still prevent changing any inactive member's contribution; harmless description edits remain allowed.

## Minimal settlement read storage

The active schema previously had no settlement records. An additive migration now adds Settlement with group, sender, receiver, recorder, BIGINT amount, method, timestamp and request key. Composite membership foreign keys constrain sender/receiver/recorder to the same group. SQL checks require positive bounded amounts and distinct sender/receiver. Indexes cover group chronology, sender, receiver and scoped request-key uniqueness.

The application runtime has SELECT only on this table. INSERT/UPDATE/DELETE/TRUNCATE are explicitly revoked. There is no recording API/action/UI, payment transfer, reversal service or settlement suggestion. Test maintenance fixtures insert payments only into the isolated test database to verify the required persisted-settlement scenario. Any later recording workflow must be separately approved and add involved-party/admin authorization, group locking, current-balance validation, idempotency/audit and correction policy.

## Integration and browser evidence

The 20 new PostgreSQL tests cover all five scenarios and both corrected interpretations, saved equal rounding, current-user totals, old expense edits, deleted-expense behavior, empty groups, expenses beyond a 25-row page, group isolation, forged client fields, anonymous access, separate cross-group debt/receivables, exact-zero removals, former-member history, read-only settlement grants/SQL constraints, deleted groups and protected page rendering.

A coordinated snapshot test starts a RepeatableRead transaction, establishes the old expense snapshot, commits an edit on a separate connection, then collects related rows. The old snapshot remains consistent at A +1000/B −1000 BDT; the next normal read sees A +2000/B −2000. Both group totals are exactly zero. Corrupting an allocation through the test owner makes the service reject it and the HTTP page display “Balances unavailable” without a zero-sum badge. The original allocation is restored afterward.

Browser checks used a separate localhost:3200 origin backed by the test database, leaving the 127.0.0.1 user session intact. A disposable two-member fixture with a persisted BDT 1000 expense and BDT 400 settlement displayed Ayesha +600 and Bashir −600, current-user receivable 600, and verified group zero. Expanded contributions showed expense +1000/−1000 and settlement −400/+400. At a 390px viewport the 603px table scrolled inside its 333px container; document width stayed 375px, so it did not widen the page. The viewport was reset. Screenshot: ignored artifacts/phase4-balances.png. Both fixture accounts/group and temporary server were cleaned up. The normal server remains on port 3000.

## Corrections and remaining limits

Initial pure-test discovery failed because Vitest's `%j` test-name formatter attempted JSON serialization of a BigInt. The label was changed to field interpolation; no accounting code, expectations or global serialization behavior was weakened. All subsequent checks passed. The existing Prisma/pg concurrent-query deprecation warning remains; it is not suppressed or a failed critical test.

The reader currently loads the complete ledger into memory, with a 15-second read transaction limit. SQL aggregation/streaming or paginated contribution detail may be appropriate for large groups later; no production-scale claim is made. There is no balance cache to become stale. Existing authentication recovery/verification, shared abuse protection, dependency maintenance and retention limitations remain.

No new packages, subagents or deployment were used for Phase 4. Await explicit approval before settlement suggestions or any later scope.

## GitHub publication verification

At the user's subsequent request to check, commit and push, reran all 89 unit tests, all 79 PostgreSQL integration tests, TypeScript, zero-warning ESLint, production build and all four clean-schema migrations. All passed before pushing. The first build attempt exited without a diagnostic; a fresh captured build passed with no source changes. No application fix or empty commit was needed. The existing implementation and report commits (`c80d6ab`, `77897ac`) were pushed to `origin/codex/phase-4-balances`; publication notes were updated in a separate documentation commit. The local app was restored on port 3000. No merge or change to the default branch was performed.
