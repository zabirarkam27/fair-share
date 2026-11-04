# Phase 3 — Expense Management and Financial Split Engine

Implemented on 4 November 2026 (Asia/Dhaka), under explicit Phase 3 approval. Local implementation commit: `2694b0d`. No balances, settlement suggestions, payments/reversals, deployment or remote push were added.

## Actual results

| Check | Result |
| --- | --- |
| Focused engine suite before persistence/UI | 42 passed |
| Final unit suite | 60 passed in 6 files: 43 split/codec tests + 17 retained tests |
| Final PostgreSQL integration suite | 59 passed in 3 files: 25 expense + 20 group + 14 auth |
| TypeScript | Passed (`npm run typecheck`) |
| ESLint | Passed, zero warnings (`npm run lint`) |
| Production build | Passed (`npm run build`, Webpack) |
| Prisma | Schema valid; client generated successfully |
| Dev/test migration | Additive expense migration applied to both successfully |
| Empty-schema migrations | All 3 migrations passed (`npm run test:migrations`) |
| Browser | All four methods saved; edit/delete, precision rejection, excluded payer and 390px mobile form verified |

The generated property test runs 2,000 deterministic scenarios across all four methods: 8,000 allocation results checked for exact conservation and nonnegative BigInt amounts. These are assertions within one test, not 8,000 separately reported Vitest tests. Final integration output: ignored artifacts/phase3-integration.log.

## Required financial cases

Amounts below are integer poisha. Stable expense-ID rotation chooses recipients when remainders tie; a fixed first member is not favored.

| Case | Verified outcome |
| --- | --- |
| Equal 10000 / 3 | 3334 + 3333 + 3333 |
| Equal 1 / 3 | 1 + 0 + 0 |
| Equal 9999 / 4 | 2500 + 2500 + 2500 + 2499 |
| Exact correct sum | Accepted, including zero allocations |
| Exact incorrect sum / negative / missing participant | Rejected |
| Percentage 50/30/20, total 10000 | 5000 + 3000 + 2000 |
| Percentage 33.33/33.33/33.34, total 10000 | 3333 + 3333 + 3334 |
| Percentage total below/above 100% | Rejected |
| Invalid precision/fractional basis points | Rejected; 50.25 parses as 5025 basis points |
| Shares 2:1:1, total 10000 | 5000 + 2500 + 2500 |
| Shares 1000000:999999:1, total 100000000 | 50000000 + 49999950 + 50 |
| Zero/negative/fractional weights | Rejected |

Additional tests cover largest fractional remainder priority, stable rotation for equal/percentage/shares, reordered inputs, immutable inputs, invalid/duplicate/empty members, invalid totals and formatting beyond Number precision.

## Representation and model relationships

The pure engine has no database/auth/UI/random-state dependency. Proportional products, floors, remainders and sums use BigInt. Basis points are safe integers 0..10000 with total 10000. Only bounded array indices/remainder counts become Number. Expenses are 1..100000000 poisha (BDT 1,000,000 maximum); weights are 1..1000000. Parsing rejects signs, exponents, extra decimal places and malformed amounts. Zero is valid for exact allocations, never expense totals.

Group has many expenses. Each expense references its group-scoped payer and immutable creator through GroupMember. Each ExpenseSplit references both `(groupId,expenseId)` and `(groupId,userId)`; its `(expenseId,userId)` primary key prevents duplicates. Composite foreign keys prevent cross-group references. Membership records survive departure.

PostgreSQL/Prisma amounts are BIGINT poisha. Result/audit `amountPoisha` fields are decimal integer strings; form `amount` is a BDT decimal string parsed at the boundary. `inputUnits` retains exact poisha, basis points or weights according to split type; equal splits use null. SQL DATE becomes YYYY-MM-DD. No global BigInt serialization override exists.

Indexes: expense `(groupId,deletedAt,date,id)` supports paginated lists; `(groupId,paidById)` and split `(groupId,userId)` support references/removal checks; unique `(groupId,id)` supports composite child references; unique `(groupId,createdById,requestKey)` enforces scoped retries. SQL checks enforce amount bounds, nonnegative allocations/input units and positive versions. Cross-row totals and parent split-type rules are transactional service invariants, not SQL CHECK guarantees. Another independent database writer would need equivalent validation.

## Server permissions and transactions

Every operation resolves a verified Better Auth session and checks active membership in a live group. Posted creator/role/precomputed allocations are rejected. Payers may be excluded from participants; all references must belong to the group. New expenses require active members. Edit/delete authorization checks the original creator or current admin inside the transaction; a payer alone receives no extra authority.

Writers lock the same group row before authorization-sensitive reads/writes. Expense/split creation and audit commit atomically. Edits replace splits, increment the version and retain before/after snapshots atomically. Deletion increments the version and sets deletedAt while preserving splits/history. Runtime grants prevent hard deletion of expenses and mutation/deletion of activity. Reads use a consistent snapshot; lists contain 25 expenses per page.

Real PostgreSQL tests verify group isolation, ID swapping, anonymous denial, forged fields, author/admin rules, all four persisted input types, malformed/zero/negative/precision/date validation, stale versions, concurrent edits, idempotent concurrent creates and request-key conflicts. Revoking audit INSERT rolls back create/edit/delete, including split replacement. Database constraints reject negative/cross-group references. Concurrent expense creation/removal cannot strand obligations. Soft-deleted groups hide expenses while preserving records.

## Historical members and interim restriction

Balances were explicitly excluded. Removal conservatively rejects any member named as payer on a live expense or receiving a positive live allocation. Even offsetting/self-only expenses block removal. Soft-deleted expenses do not block it. Zero-allocation participants may be removed if they are not payers.

Edits may retain original inactive references but introduce none. Every inactive member's proposed per-expense contribution must equal its previous contribution; deletion requires the old contribution to be zero. Tests prove description edits remain possible for a former zero-allocation participant, while assigning them debt fails. Replace the interim involvement guard with full-ledger zero-balance checks only after approval of balances.

## Browser evidence and corrections

Browser checks used localhost:3200 and the isolated test database, separate from the existing 127.0.0.1:3000 session. A disposable account/group and two roster fixtures exercised equal creation, exact/percentage/shares edits, invalid precision disabling Save, mobile dialog scrolling, deletion and payer exclusion. Saved 2:1:1 amounts displayed BDT 50/25/25. The final excluded-payer expense displayed BDT 50/50. Screenshot: ignored artifacts/phase3-expenses.png. All three browser fixture accounts/group and the temporary server were cleaned up; the normal server was restored on port 3000.

The first PostgreSQL run caught Prisma rejecting nested composite-relation split creation (`Unknown argument groupId`): 19 expense tests failed, 38 tests passed. Explicit expense/split writes within the same transaction corrected it. Subsequent suites passed, ending at 59/59 with additional cases. TypeScript caught Vitest array-row argument spreading in the invalid-participant parameterization; object rows now exercise the intended arrays. Review also removed a duplicated currency prefix. No failed check was suppressed or presented as a success.

The final run emits a pg deprecation warning about concurrent client.query calls. `--trace-deprecation` points into `@prisma/adapter-pg` PgTransaction.performIO/queryRaw and Prisma relation evaluation. Pinned pg 8.23.1 executes these queries and all tests pass. Review adapter/driver compatibility before pg 9; no warning suppression or dependency patch was added.

No new packages were installed. Prior recovery/verification, distributed abuse-control, dev-tool maintenance and retention limitations remain. This is not a production-readiness claim. Await explicit approval before further phases.
