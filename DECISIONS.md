# FairShare reviewed decisions

Status: authentication, groups, expenses and four split methods are implemented under approval through Phase 3. Balance/settlement rules below remain a future target. Evidence: docs/PHASE_3_REPORT.md. Implementation differences: ARCHITECTURE.md.

## Technical choices

Use Next.js App Router with strict TypeScript and Node runtime. Server pages perform authorized reads; Server Actions perform mutations through feature services. Route Handlers serve Better Auth and only genuinely HTTP-oriented endpoints. A separate Express API would add deployment and session plumbing without improving this assessment.

PostgreSQL + Prisma now replace the archived Drizzle implementation under explicit approval. Expense allocations are normalized into ExpenseSplit rows. Group/member composite foreign keys prevent cross-group references. Transactions cover each expense mutation and its immutable audit event. Membership and expense writers share the group-row lock; future settlement writers must do the same.

Pinned and runtime-tested: Next.js 16.4.5, Better Auth 1.7.16, Prisma CLI/client/adapter-pg 7.10.1, Node 24 and TypeScript 5.9.3. Better Auth uses nextCookies last and explicit Prisma-adapter transactions. Preserve the UTC adapter setting found necessary by the expired-session regression. See the reports for actual evidence and remaining dependency limits.

Use Better Auth's Prisma adapter for accounts, hashing, sessions and cookies. Use Tailwind/shadcn + Lucide for accessible UI, React Hook Form for form state, and shared Zod schemas for validation. Browser validation helps users; server validation is authoritative. Use Vitest and real, isolated PostgreSQL integration tests.

Money is BigInt poisha internally and PostgreSQL BIGINT in the target. Transfer money in DTOs as decimal strings. Do not use floating-point values in business calculations. One expense/payment is capped at BDT 1,000,000; group aggregates remain BigInt. Percentages use basis points and shares require positive integers.

## A4.1 Who receives the extra poisha?

Use largest-remainder allocation. For equal remainders, sort stable member IDs and rotate tie priority with a stable expense-ID hash. BDT 100 split three ways becomes 33.34, 33.33 and 33.33. The same expense and inputs always produce the same result; request ordering cannot change it. Different expense IDs vary priority, reducing systematic bias. This is deterministic fairness, not a guarantee that every member receives precisely equal remainder counts over time. Preserve the ID through edits.

## A4.2 Leaving while owing BDT 500

Phase 3 interim policy: balances are expressly out of scope, so removal rejects any member named as payer on a live expense or receiving a positive allocation. Even offsetting or self-only expenses block removal. Zero-allocation participants may be removed if they are not payers. Historical correction/deletion enforces zero change in every inactive member's per-expense contribution. Replace the interim guard with full-ledger zero-balance checks only in an approved balance phase.

Reject leaving/removal while the member has a nonzero balance, whether they owe or are owed money. Keep membership/history and distinguish LEFT from REMOVED. LEFT members may rejoin through a current valid link; REMOVED members require explicit admin reactivation, so an old link cannot defeat removal. After departure, any expense edit/delete or settlement reversal must leave that inactive member's net balance unchanged at zero. Harmless text edits remain possible; a financial correction affecting them requires reactivation. The single admin cannot leave without a transfer feature; initially they may soft-delete the group instead.

## A4.3 Editing an old expense after settlement

Allow an active author/admin to edit with an expected version. Explain that the change affects today's balances even after previous settlement. Preserve existing payment records and write before/after values, original inputs, exact allocations, actor ID/name and timestamp atomically. Historical inactive references may be retained, but no new inactive references introduced; every inactive member's proposed financial delta must be zero. This permits description/date corrections without forcing rejoin. Recorded payment mistakes are corrected with a full append-only SettlementReversal, followed by a correct new payment if needed. Closed periods remain deferred.

## A4.4 Stored or calculated balances

Expenses, saved allocations, settlements and reversals are the source of truth. Calculate net balances; never allow manual balance edits. Positive means is owed, negative means owes. Payments sent increase the sender's balance and reduce the receiver's; reversals apply the exact opposite. Read a consistent snapshot, use indexed group-scoped aggregation and convert exact SQL aggregate text into BigInt. A cache/materialized read model is a later measured optimization with reconciliation/invalidation tests. Persist rounded allocations so future algorithm changes cannot rewrite old bills.

## A4.5 Does the algorithm always minimize payments?

No. The initial deterministic greedy algorithm matches the largest debtor with the largest creditor and settles one of them each step. It clears all balances in at most k-1 payments for k nonzero members, but is not globally optimal. Example in poisha: debtors 8, 7, 6; creditors 9, 8, 4. Greedy makes five payments. Four suffice: 8→8, 7→9, 2 of the remaining 6→9, 4→4. Tests must preserve this counterexample. Exact combinatorial search is excluded from the core time box; the UI must not call the output the guaranteed minimum.

## A4.6 One risky or missing requirement

Settlement recording does not establish that a transfer happened or the recipient agrees. Allow only an active involved party/admin to record, label entries as user-recorded, retain immutable actor/time/method history and require idempotency keys. Reject overpayments against locked current balances. Add a unique full reversal with actor/reason/time, without editing/deleting the original. Keys prevent request retries, not duplicate real-world claims under different keys. Receiver confirmation and disputes remain production gaps. Invite expiry, password recovery and data retention also need explicit policies; a soft-deleted group is not erased data.

## Other boundaries

- BDT only; multi-currency requires agreed FX and rounding policies before implementation.
- One payer per expense. Payer may be excluded from participants.
- Up to 100 active group members; no recurring expenses or exact settlement optimizer in core.
- Bounded full-settlement reversal is the only corrective workflow added to core; no separate Balance or ExpenseRevision entity.
- READ COMMITTED + consistent group-row lock for writes; short REPEATABLE READ snapshots for multi-query ledger reads.
- Non-owner runtime credentials enforce append-only grants on Activity, Settlement and SettlementReversal; migrations/fixture cleanup use separate credentials.
- Test, dev and migrate-dev shadow databases are distinct; real committed test fixtures are required for auth/concurrency testing.
- Admin-controlled invitation issuance; hashed tokens, seven-day expiry, explicit rotation/revocation.
- Group deletion is a soft delete with invite revocation; normal group access disappears while audit history is retained.
- SQL DATE for expense date; UTC timestamps for creation/activity. UI renders user-local activity time.
- Candidate must review AI_LOG.md and write/revise their personal responses; do not fabricate personal authorship.
