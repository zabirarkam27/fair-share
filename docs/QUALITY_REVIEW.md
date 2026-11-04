# FairShare quality review — 4 November 2026

Scope: the original supplied assessment, the user's master instructions and approved Phases 1–7. This review adds only requested demo provisioning, a query-budget regression test and documentation. Verified tooling/test commit: `398a7a0`, on the existing `codex/phase-1-auth` branch. No critical application defect was identified in the reviewed/tested paths, so no product code, dependency or schema was changed. This is not a declaration that the assessment has been fully submitted or completed.

`PASS` means the stated scope has supporting evidence. `FAIL` means an evaluated criterion is not met. `NOT IMPLEMENTED` means the capability/deliverable is absent. `NOT VERIFIED` means evidence or candidate confirmation is missing. Optional or proposed work is labelled separately from core requirements.

## Executed checks

| Requested check | Status | Actual result |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck`, strict TypeScript; final production build also type-checks |
| ESLint | PASS | `npm run lint`, zero warnings |
| Unit tests | PASS | `npm test -- --reporter=verbose`: **110 passed**, 9 files |
| Integration tests | PASS | Expanded `npm run test:integration`: **138 passed**, 8 files, real isolated PostgreSQL and Better Auth sessions |
| Production build | PASS | `npm run build`; all 13 requested screen types/routes compile |
| Database migrations | PASS | `npm run test:migrations`: all **5** migrations applied to a new empty isolated schema; no public/dev/demo database reset |
| Prisma model validation/drift | PASS | `npm run db:validate`; read-only migrated-test-database diff to `prisma/schema.prisma`: **No difference detected** for Prisma-supported objects |
| Financial invariants | PASS | Included in unit and PostgreSQL suites: exact split totals, nonnegative allocations, per-record/group zero sums, corruption rejection, settlement signs and complete-plan replay |
| Authorization | PASS | Anonymous/forged/expired sessions, creator/admin boundaries, active membership, administrative actions and unrelated settlement recorder rejection |
| Group isolation | PASS | URL/resource/member/group tampering, composite FKs, cross-group records, activity feed and focused page denial assertions |

The first integration attempt encountered a Windows Vitest worker exit (`3221226505`) while starting the settlement file: **108 tests passed, 29 settlement cases did not complete**, one unhandled worker error, command failed. A full retry passed **137/137**. After adding the query-budget regression the full suite passed **138/138**; a focused verbose query test passed independently. No assertions were disabled, no checks ignored, and no business code was changed to hide the crash. The crash's underlying cause is **NOT VERIFIED**; reproduce/capture the worker failure before changing Node/Vitest or claiming CI reliability.

## Core requirement checklist

| Requirement | Status | Evidence / scope |
| --- | --- | --- |
| Next.js App Router, strict TypeScript, Node | PASS | Active configuration and successful checks/build |
| Tailwind, shadcn/ui, Lucide, RHF, Zod | PASS | Installed/pinned packages and connected UI; no extra chart dependency without a use case |
| PostgreSQL with Prisma | PASS | Active schema, real migrations and runtime/integration verification |
| Better Auth, no custom password authentication | PASS | Library Prisma adapter, official handler/actions; stored hash differs from password in integration tests |
| Signup, signin, incorrect-credential rejection | PASS | Auth integration tests; demo accounts created/authenticated through Better Auth |
| Signout and session persistence/expiry | PASS | Persistent HttpOnly/SameSite=Lax local cookies; database revocation, refresh/expiry and forged-cookie regressions |
| Protected dashboard and session-derived identity | PASS | Page/service checks, denied anonymous routes and actor-override rejection |
| Create/list/view groups | PASS | Active-membership scoping, atomic ADMIN membership/event and protected routes |
| Generate/join invitation link | PASS | 32 cryptographically random bytes, SHA-256 storage, explicit accept; no group preview/private read before joining |
| Invalid/revoked/replaced/expired invitations | PASS | Dedicated real-database tests and post-lock token/expiry recheck |
| Duplicate membership prevention | PASS | Composite membership PK, shared group lock, concurrent duplicate join test |
| Member list and roles | PASS | Authorized group roster, roles/status display; no email in activity metadata |
| Admin-only removal/deletion | PASS | Server role check, scoped target, zero-balance removal and exact-name delete confirmation tests |
| Removed member cannot use an old invite | PASS | Retained REMOVED membership, generic invite cannot reactivate |
| Expense description/amount/date/payer/included members | PASS | Strict request schemas and persisted DTOs; payer can be excluded |
| All four split methods | PASS | Pure equal/exact/percentage/shares functions, required edge cases and saved split integration tests |
| Expense edit/delete creator or admin only | PASS | Server ownership/role check under lock; unauthorized edit/delete and routes rejected |
| Every split equals original total | PASS | BigInt conservation checks, database integration assertions and 2,000 generated iterations across methods |
| Deterministic largest remainders and rotating ties | PASS | Stable ID ordering/expense seed; reorder/tie tests; saved allocations reused later |
| Reject invalid amounts, precision, duplicates and members | PASS | Runtime engine guards, strict Zod schemas and same-group active-member validation |
| Persist exact allocations and original inputs | PASS | ExpenseSplit BigInt amount/inputUnits, final DTOs and audit snapshots |
| Net balances and explanatory contributions | PASS | Full persisted ledger, paid/allocated/sent/received and per-record detail |
| Positive owed / negative owes / zero settled | PASS | Explicit engine convention and required scenarios; inconsistent supplied examples documented rather than hard-coded |
| Group balances total exactly zero | PASS | Expense/group assertions and 1,000 generated ledger checks; corrupt rows fail visibly |
| Dashboard totals kept separate across groups | PASS | `balances.overview` sums obligations/receivables independently, complete-ledger tests |
| Settlement suggestions clear current balances | PASS | Existing engine plus independent full replay, no self/zero/negative/overpayment |
| Honest minimum-payment claims | PASS | Exact zero-sum-partition DP only <=10 nonzero members within payment cap; greedy fallback never claims global minimum |
| Greedy counterexample and exact search | PASS | Five-greedy/four-exact case; independent exhaustive search on 27 tiny ledgers |
| Suggestions do not alter balances | PASS | Read-only service/tests; no settlement write until recording |
| Record partial/full settlements with three labels | PASS | bKash/Cash/Bank tests, persisted records, ledger adjustments and local seed examples |
| Duplicate settlement request protection | PASS | Group/actor/request-key uniqueness, group lock, immutable-payload comparison, concurrent same-key tests; different keys do not identify a real-world receipt |
| Recheck live outstanding limits | PASS | Locked current debtor/creditor bounds, concurrent different-key overpayment and stale-plan tests |
| All requested activity categories | PASS | Group/member/expense/settlement events have group, actor, action, resource and timestamp |
| Preserve old/new after repeated expense edits/deletion | PASS | Three edits plus deletion regression and immutable snapshots; history does not FK-cascade with expenses |
| Members-only history and immutable runtime grants | PASS | Active-membership checks, safe metadata projection, denied UPDATE/DELETE/TRUNCATE tests |
| Atomic domain and audit writes | PASS | Same-transaction writer; revoked audit INSERT rolls back creation/join/removal/edit/delete/settlement |
| Consistent financial reads and shared write lock | PASS | RepeatableRead snapshots; every existing-group membership/expense/settlement writer locks the same group row; new group creation is atomic before it is externally visible |
| Responsive connected screens and dynamic forms | PASS | Phase 7 browser evidence at 1440px/390px and current protected HTTP route suite; new calculations stay on server |
| Loading/error/success/empty and destructive confirmations | PASS | Existing skeleton/boundaries/forms/notices; removal/group/expense confirmation controls and Phase 7 browser inspection |
| Consistent BDT currency display | PASS | Shared BigInt-safe formatter, including values beyond Number precision |
| Local demo data and actual credentials | PASS | Four provisioned Better Auth accounts, two groups, five expenses, four settlements; generated passwords stored privately, verified seed rerun |

## Detailed financial/security/performance review

**Floating point and serialization.** Active monetary amounts/products/divisions are BigInt poisha. `Number` operations in percentage parsing operate only on bounded digit-derived integer basis points (0–10,000); remainder/index conversions are bounded below the member count; bitmask operations index the <=10-member exact search. They do not convert monetary totals into floating point. No `parseFloat`, financial `toFixed`, global `BigInt.prototype.toJSON` patch or client financial engine was found. Financial DTO/audit fields call `.toString()` explicitly; JSON serialization and oversized formatting have tests.

**Rounding and zero sums.** Weighted/percentage allocation floors exact products and distributes remaining poisha by largest remainder; ties rotate stable sorted IDs using the expense ID. This is reproducible, not a promise of perfectly equal lifetime tie counts. A new-expense preview has a provisional seed and discloses possible one-poisha differences at save; persisted allocations are authoritative. Credit payer/debit allocations; credit settlement sender/debit receiver. Historical edits reopen today's balances without rewriting prior payments. Inactive members' contributions cannot be changed by financial corrections, though harmless text edits remain allowed.

**Transactions/permissions.** Mutation actions validate input and call server-only feature services. Services obtain a fresh trusted session, check active membership/live group, then check role, resource ownership and group binding as appropriate. Group create and invite accept are the intentional membership-creation operations; they do not require membership that does not yet exist. Join looks up the token, locks, then rereads hash/expiry/deletion to close rotation races. Existing-group writers share row locks, optimistic expense versions and scoped retry keys. Activity/settlements are append-only to the restricted runtime role; the database owner retains maintenance authority. This is not owner-proof tamper protection. SQL FKs/unique/check constraints supplement, but do not replace, service-level split totals and permissions.

**N+1 query evidence.** The new real-database `tests/integration/query-budget.test.ts` instruments emitted domain SELECTs without changing production code. Expense list: **8 SELECTs with 1 expense and 8 with 25**. Cross-group overview: **7 SELECTs with 1 group and 7 with 8**. Auth queries use a separate client and are excluded from these counts. Batch relation/ledger reads avoid one query per expense/group in these paths. Layout/page authorization is intentionally repeated, and full-ledger transfer/calculation still grows with record count. The 40-member/5,000-expense six-second scenario has **NOT VERIFIED** latency; benchmark/profile it before promising an SLO or adding a cache. Existing group-scoped indexes cover ledger lists, memberships, retry keys and history; no speculative index or cache was added.

**Environment exposure.** Source access to database/auth variables is confined to server-only modules; no active NEXT_PUBLIC_ setting is needed. A value-based scan found **zero matches** for the current configured DB/auth secrets, long DB passwords and actual generated demo passwords in **56 `.next/static` files and 187 tracked files** at scan time. Only `.env.example` is tracked as an environment file. This checks known current values, not every unknown or historical secret. Example values are explicitly labelled nonworking placeholders. Demo secrets, sessions, generated client, PostgreSQL files and local evidence stay ignored.

## Findings and incomplete criteria

| Criterion | Status | Issue and recommended fix |
| --- | --- | --- |
| Dependency tree entirely advisory-free | FAIL | `npm audit --json` reports **19 moderate and 2 low vulnerable package entries**, no high/critical; minimatch/deepmerge chains affect lint/shadcn tooling. `npm audit --omit=dev` reports **0**. Review compatible toolchain updates/overrides separately; do not apply npm's suggested ancient major downgrades. No unrelated upgrade made. |
| Stable Windows worker execution | NOT VERIFIED | One native worker crash occurred; full retries passed. Capture/reproduce the failure and investigate the pinned Node/Vitest/native environment; no root cause is claimed. |
| 40-member/5,000-expense latency | NOT VERIFIED | Query budgets are verified at smaller sizes, not representative load latency. Profile SQL plans/rows, transfer, calculation and render time before selecting aggregation/caching. |
| Specific independently written contribution (Part B.4) | NOT VERIFIED | Candidate reports: “I wrote most of this, write something”. No specific component/reason is confirmed; AI-authored changes in this chat are recorded. Candidate must name the actual independent work and explain it. Do not invent one. |
| Part C in candidate's own words | NOT VERIFIED | ANSWERS.md contains three clearly labelled AI-assisted drafts. Candidate must review, understand and rewrite/approve them. File presence does not verify authorship. |
| Candidate's selection of two “best” prompts | NOT VERIFIED | Two exact real prompts are included with Codex's reasoning. Candidate should confirm which were best for them. |
| Required <=5-minute screen recording | NOT IMPLEMENTED | No recording delivered in this workspace. Candidate should record a demo, a defensible strength and an improvement, within five minutes. |
| Assessment deadline/effort/submission | NOT VERIFIED | Receipt timestamp, personal effort and submission confirmation are not evidenced. Candidate must confirm; no hours or deadline compliance is invented. |
| Public GitHub repository exists | PASS | `gh repo view` returned PUBLIC and default branch `codex/phase-1-auth` for zabirarkam27/fair-share |
| Reviewed local work published to GitHub | NOT IMPLEMENTED | Latest phases/review remain local. Obtain explicit approval and push verified commits on the same branch before submitting that revision. |
| Hosted deployment/demo URL | NOT IMPLEMENTED | Optional deployment bonus; no URL is claimed. README gives a procedure, not deployment evidence. |
| Production HTTPS Secure-cookie/TLS/backup/restore operations | NOT VERIFIED | Local HTTP tests do not verify deployed security/operations. Configure and verify on the chosen host before calling it production-ready. |
| Shared join-link/auth-action abuse throttling | NOT IMPLEMENTED | Better Auth's in-memory HTTP limiter does not establish distributed throttling or cover all direct Server Actions. Add an explicitly approved shared limit before public deployment; this is also an optional join-link bonus. |
| Password recovery/email verification | NOT IMPLEMENTED | Production account-recovery/verification workflows remain unconfigured; not core signup/signin requirements. Add provider/delivery policy before deployment. |
| Recipient confirmation/disputes/payment reversal | NOT IMPLEMENTED | Recording is an involved user's/admin's assertion, not proof of money movement. Proposed correction/confirmation workflows need separate approval; no reversal model/writer exists in applied schema. |
| Multiple payers, recurring expenses, CSV export | NOT IMPLEMENTED | Optional bonuses intentionally excluded; preserve the solid core rather than introduce them during review. |
| Dark-mode control | NOT IMPLEMENTED | Optional theme control is absent; no nonworking toggle is shown. |
| Full assistive-technology audit | NOT VERIFIED | Prior UI checks cover labels/focus/viewport behavior, not a comprehensive screen-reader audit. |

## Local demo evidence and documents

The guarded seed command is `npm run db:seed:demo -- --local`. It uses the local development database, not integration-test storage; tests remain on `fairshare_test`. Four actual generated email/password pairs are in ignored `.local/demo-credentials.json`. No password or cookie is committed or fabricated. The helper authenticates via Better Auth and uses real sessions for the same feature services; it does not insert a custom password hash or bypass product permissions. Re-running authenticated the existing users and reused the same expense/payment request keys, leaving **2 groups / 5 expenses / 4 settlements**. A separate HTTP smoke check then authenticated all four accounts, verified session identity and **12 protected dashboard/group page responses**, and signed them out. Rapid initial signin checks received the library's expected 429 response; spacing checks beyond its three-signins/ten-seconds special rule completed successfully without changing/disabling the limiter. No demo account credentials failed authentication. The normal app is available locally on port 3000; this is not a deployed URL.

The trip demo retains an exact dinner edit from ৳1,000 to ৳1,100, equal ৳4,000.01, percentage ৳999.99 and 2:1:1 shares ৳400. Partial Cash/bKash records leave net poisha: **Ayesha +139752; Rafi -37750; Nusrat -22001; Hasan -80001**, summing to **0**. The second group contains a ৳1,200 expense and Bank/bKash payments of ৳600 each; all four members are exactly zero. The outstanding group's suggestion plan has three payments and independently clears balances; the settled group has none. Actual verification is saved in ignored `.local/demo-verification.json`. Negative guard probes rejected missing `--local`, production mode and a test-database target before writing the demo manifest.

README now includes setup, environment roles, migrations, seed/actual-login instructions, tests, deployment procedure and limits. `.env.example` contains explicit placeholders only. DECISIONS answers all six A4 questions and separates reversal proposals from implemented behavior. AI_LOG records observed AI work, mistakes, exact prompts and the authorship self-report. ANSWERS contains all three reviewed-question drafts with a candidate-review gate. plan/AGENTS preserve this quality-only scope and publication gate.

**Conclusion:** the reviewed core automated/financial/security gates pass. The assessment is **not declared complete** while candidate-only disclosure/review, recording and submission/publication requirements remain outstanding. Do not infer deployment or human authorship from passing tests.
