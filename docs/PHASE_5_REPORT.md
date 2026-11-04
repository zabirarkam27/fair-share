# Phase 5 — Settlement Suggestions and Recording

Implemented under explicit Phase 5 approval on 4 November 2026 (Asia/Dhaka). Code commit: `3067153`, on the original `codex/phase-1-auth` branch. Phase 5 is local and not pushed, awaiting review. The preceding single-branch request was completed separately: Phase 4 was fast-forwarded/pushed to that original branch, and its redundant branch removed after consolidation. No reversal workflow, deployment or next phase was implemented.

## Actual results

| Check | Result |
| --- | --- |
| Initial pure planner suite, before UI | 13 passed |
| Final unit suite | 104 passed in 8 files (15 planner + 89 retained) |
| PostgreSQL/real-session integration | 108 passed in 5 files (29 settlement + 79 retained) |
| TypeScript | Passed (`npm run typecheck`) |
| ESLint | Passed, zero warnings (`npm run lint`) |
| Production build | Passed (`npm run build`, Webpack) |
| Prisma/client | Generated successfully; enum-only additive migration applied to dev/test |
| Clean migration chain | All 5 migrations passed in a new isolated PostgreSQL schema |
| Browser | Partial/full recording, live balance/plan refresh, all three history labels and responsive form verified |

The normal app remains at 127.0.0.1:3000. Ignored local evidence: artifacts/phase5-build.log, artifacts/phase5-integration.log and artifacts/phase5-settlements.png. No new packages or subagents were used.

## Suggestions are read-only

The service authenticates the session, authorizes active membership in a live group and reads the entire ledger in a RepeatableRead transaction through the existing balance reader. It rejects unresolved inactive-member balances rather than suggesting a payment that cannot be recorded safely. No client-provided balances, actor ID, role or allocations are accepted. No suggestion rows are stored as settlements.

The independent pure engine consumes BigInt net balances, validates member identifiers/uniqueness and exact group zero, and generates same-group debtor-to-creditor payments. An independent replay checks each payment for positive integer amount, distinct known members, negative sender/positive receiver state, both outstanding bounds and the recordable amount cap. Only a plan whose replay leaves every member exactly zero is returned. Viewing/rendering the plan makes no financial writes; integration tests compare balance results and settlement/audit counts before/after.

## Optimization, proof and bounded fallback

Zero-balance members are removed before planning and remaining IDs sorted for deterministic ordering. Every tie is resolved using stable IDs; input order cannot change the plan.

| Mode | Selection | Time | Space | Minimum-count claim |
| --- | --- | --- | --- | --- |
| Exact zero-sum partition DP | At most 10 nonzero members; each absolute net <=100000000 poisha | O(3^n) | O(2^n) | Guaranteed for this bounded case |
| Largest-debtor/creditor greedy | More than 10 nonzero members, larger individual amounts, or explicit internal test mode | O(P n log n) | O(n+P) | No global-minimum guarantee |

Here n is nonzero members and P is output payments. Exact search precomputes subset sums and maximizes the number of disjoint zero-sum partitions, enumerating subsets that contain a fixed anchor to avoid duplicate partition orders. Minimum transactions = n − maximum partitions. Any connected payment component must be zero-sum and requires at least its member count minus one edges. A maximum partition has no splittable zero-sum component; greedy within each component attains that bound. With individual absolute balances within the per-payment limit, that limit cannot bind these transfers. This establishes the bounded minimum claim.

The 10-member threshold limits masks to 1024 and the subset-enumeration bound to 3^10. The planner falls back before allocating exponential state for larger groups. Greedy sorts current debtors/creditors each step, pays the smaller outstanding amount, and applies the existing 100000000-poisha (BDT 1,000,000) per-record cap. Larger obligations become multiple recordable chunks. Capped chunks can mean more than n−1 payments. At more than 1000 required payments, planning fails visibly instead of returning a partial plan or running unbounded work. Valid group balances remain available separately.

Tests preserve the counterexample: debts 8/7/6 poisha, credits 9/8/4. Greedy emits five payments, exact mode four. The exact planner also matches an independent breadth-first exhaustive search over every legal positive payment amount for 27 tiny four-member ledgers; that oracle does not reuse subset-partition logic. Tests cover the exact ten-member boundary, larger-group fallback, cap chunking, 1000 generated ledgers, stable reordered inputs, immutable inputs, invalid plans and output-budget failure. Generated assertions are not counted as separate Vitest tests. The UI claims the fewest payments only when exact mode proves it; greedy is explicitly labelled as not guaranteed minimum.

## Recording and accounting boundary

The UI labels payment methods bKash, Cash and Bank and asks the user to record only a payment that has already happened. A suggested payment is merely prefilled form data. Users can instead enter a partial payment or choose another valid debtor/creditor pair. No payment-provider SDK, transfer, bank credential or receipt verification was added.

The Server Action strictly parses group/member IDs, BDT amount string, method enum and request UUID, derives actor identity exclusively from the authenticated session, and calls the trusted service. The service:

1. Locks the group row and rechecks active actor membership/live group status.
2. Looks up the actor/group/request key. An identical semantic payload returns the existing immutable record and fresh balances without another write/event; changed sender/receiver/amount/method conflicts.
3. For a new record, requires the actor to be sender, receiver or group admin. Both counterparties must be active members of this same group and must differ.
4. Reads the complete ledger under the same lock and requires a current negative sender and positive receiver. The amount must be positive, within the per-record cap and no more than either outstanding magnitude.
5. Inserts the settlement and SETTLEMENT_RECORDED audit snapshot atomically. Identity, method and integer poisha are saved from server-validated values.
6. Recalculates the full ledger before commit, verifies group zero and returns serialized balances. Dashboard/group rendering is revalidated afterward.

Recording increases sender balance and decreases receiver balance by the saved amount. Partial payments reduce the remaining suggestion; full payments clear it. The group lock is shared with expense edits/deletes, invitations and member removal, preventing stale suggestions or concurrent requests from overpaying. The existing inactive-history safeguards remain.

The unique `(groupId,createdById,requestKey)` constraint backstops idempotency. The form retains its UUID while open and preserves it on a transport error; controls are disabled during submission. Network retries with the same details are safe even after balances became zero. A different payload under that key fails. Different keys/actors cannot prove that two claims represent the same real-world transfer; they may still record duplicate partial claims while debt remains. Recipient confirmation/disputes remain a production gap, not a claimed feature.

## Schema and permissions

Phase 4 already added Settlement and its positive-amount, nonself, same-group membership and scoped-key constraints. Phase 5 adds the SETTLEMENT_RECORDED activity enum via the fifth additive migration. Runtime privileges now grant SELECT/INSERT on settlements and still revoke UPDATE/DELETE/TRUNCATE; activity remains SELECT/INSERT only. A recording and its audit either both commit or both roll back. No settlement update/delete API or reversal table/service is enabled.

The earlier Phase 4 integration assertion of SELECT-only settlement access was updated to this explicitly approved append-only contract. It continues to reject invalid cross-group insertion, updates/deletes and invalid SQL amounts/parties. The dedicated Phase 5 tests exercise authorized inserts through the real service and verify audit immutability and atomic rollback.

## Integration evidence

The 29 new cases cover the requested one/multiple debtor/creditor combinations, exact zeros, partial/full payments, repeated submissions, invalid IDs and cross-group attempts. They also cover all three method values; sequential/concurrent same-key replay after full settlement; conflicting payload reuse; competing full/partial keys; sender and receiver bounds; self/zero/negative/fractional amounts; unrelated member denial; nonadmin receiver/admin recording; anonymous/forged identity denial; removed/deleted group handling; stale suggestions after an expense edit; audit failure rollback; append-only settlement/history privileges; record/removal race; capped large plans; and protected HTTP rendering with no recording on GET.

Every successful balance check totals exactly zero. Concurrent different-key full recordings yield one success and one conflict, leaving one record. Concurrent 600 BDT payments against 1000 BDT debt leave a single payment and 400 BDT remaining. Same-key duplicate submissions yield one record and one audit event. An audit INSERT denial causes no settlement insertion and no balance change. Test fixtures use verified Better Auth cookies and a dedicated PostgreSQL test database; identity and DB constraints are not mocked.

## Browser evidence and actual corrections

A separate localhost:3200 test origin used two disposable fixture accounts and a persisted BDT 1000 expense with an initial BDT 400 Cash record. The page suggested the remaining 600 without changing the ledger. A 200 Bank record reduced it to 400; a 400 bKash record cleared both members to exactly zero and displayed “Everyone is settled. No payments needed.” History retained all three method labels. The responsive form, disabled submitting controls and existing group zero badge were observed. The temporary viewport override was reset. Both fixture accounts/group and the temporary test server were cleaned up; no existing user account/group/session was changed.

TypeScript initially caught generic inference for a test's Object.freeze callback; an explicit arrow retained the correct NetBalance type. ESLint rejected JSX construction in try/catch; the data fetch is now caught separately from rendering. The owned PostgreSQL process had stopped between turns, causing one ECONNREFUSED migration-check attempt; restarting its existing data directory recovered it without a reset, and the full check then passed. No critical failure was bypassed or committed while unresolved. The existing Prisma/pg deprecation warning remains documented and unsuppressed.

## Approval boundary

Settlement corrections/reversals, recipient confirmation/disputes, operational hardening, deployment and further phases require separate approval. A wrong recorded payment cannot currently be edited/deleted through the app; an approved immutable correction workflow is still needed. Previous authentication recovery/verification, shared abuse controls, retention and large-ledger in-memory read limits remain. This phase makes no production-readiness claim. Await user review before later work or Phase 5 publication.
