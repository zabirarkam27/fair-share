# Actual AI usage log

## Public hosted demo access — 5 November 2026 (Asia/Dhaka)

The user explicitly requested professional admin/user1/user2/user3 demo email identifiers, a simple password, a prominent README credentials table and live link, then commit and push. Codex created four new Better Auth accounts with fictional `@fairshare.example` identifiers, preserving existing accounts and records. An ignored, host-allowlisted helper reused the existing group/expense/settlement services to provision two demo groups, five expenses and four fictional completed settlements. Both groups verified exact zero-sum balances; the settled group has all-zero member balances. No real funds were moved. Only the intentionally public demo password is disclosed in README; private credentials, cookies, database URLs and auth secrets remain excluded from Git.

All four new accounts passed actual HTTPS sign-in, persisted identity and group-page checks. A further 13 live smoke checks passed, including incorrect-password rejection, anonymous route protection, secure session cookies, the expense/balance/settlement/activity pages and signout invalidation. Newly run local checks: 110 unit tests passed, TypeScript passed and zero-warning ESLint passed. Full isolated PostgreSQL integration tests and migrations were not rerun for this documentation/fixture-only change; no schema or application implementation changed. Codex corrected outdated README deployment/publication statements and reviewed the documentation diff. Existing next-env.d.ts and .vscode changes are outside this commit.

## Final documentation cleanup after Git audit

The user approved checking the five required assessment files, fixing the remaining documentation and making the final commit. Codex confirmed the files were already tracked, added a README file checklist, and replaced obsolete phase-specific demo-login guidance with the actual guarded seed workflow and generated local credential file. The earlier quality checks and actual demo results remain recorded below; they are not claimed as newly rerun application tests for this documentation-only amendment. Git rules/plan now require message approval before each future phase commit. Only the latest unpushed documentation commit is amended with the approved message `docs: update project documentation`; published commits and working application code are preserved. No credentials, independent-human-authorship evidence, candidate answer approval, deployment or submission is fabricated. No push is included in this final-commit request.

## Quality review disclosure — candidate review required

Setup observed in this conversation: Codex in the ChatGPT desktop app, PowerShell/Node tooling, Prisma/PostgreSQL, Better Auth, Vitest, TypeScript and ESLint. Codex used the installed framework source/docs, the PostgreSQL/Next.js/PDF skills, bundled PDF extraction, shell checks and prior browser verification. No subagent or new dependency was used in this review. Other tools the candidate may have used outside this conversation are not verified.

The candidate's exact authorship statement during this review was: **“I wrote most of this, write something”.** This is recorded as a self-report. It does not identify which component was written independently or why. The AI-assisted implementation and fixes observed below remain disclosed; no unsupported percentage, personal effort, human discovery or independently authored file is inferred from that statement. For Part B.4 the candidate must supply the actual component and reason before submission. Codex has not filled that gap with an invented example.

### Three observed AI mistakes and corrections

1. Phase 3 initially attempted Prisma nested split writes with composite relations incorrectly. The recorded integration run had 19 expense failures and 38 passing tests. Codex changed this to explicit expense/split writes inside the same transaction; the actual subsequent full checks passed. This is an AI implementation correction, not a claim that the candidate personally found it.
2. Phase 7's new HTTP denial tests assumed an immediate 404/custom boundary before Next.js finished streaming. The runtime returned 200 headers plus the framework's explicit not-found signal, without private data. Codex corrected the route-specific/streaming test assumptions while retaining absence-of-private-data and permission checks. Another pre-existing test still targeted the old payment screen location and was updated to the dedicated route. No security assertion was removed.
3. During this review, Codex printed extracted PDF text through a CP1252 console and hit a UnicodeEncodeError. The UTF-8 extraction file had already been written. Codex read that file as UTF-8, verified the actual A4/Part C questions, and did not invent their contents or install unnecessary PDF dependencies.

A separate actual execution failure occurred in this review: one Windows Vitest worker exited with 3221226505, so the first integration command failed after 108 tests with settlement coverage incomplete. A full retry passed 137; the expanded suite passed 138. Root cause is not verified and the crash is not described as fixed. The existing Prisma/pg deprecation warning remains visible.

### Two exact real prompts

The following prompts are copied from the user's messages in this conversation. They are selected here by Codex because they imposed useful constraints; the candidate must confirm their own selection of “best” prompts and reasoning.

Prompt 1:

```text
Review your proposed FairShare architecture critically.

Before implementation, verify:

1. Better Auth compatibility with the selected Next.js and Prisma versions.
2. PostgreSQL money representation and BigInt serialization.
3. Group membership and authorization design.
4. Expense and ExpenseSplit relationships.
5. Historical activity preservation.
6. Settlement accounting and balance sign conventions.
7. Database transaction boundaries.
8. Invite token security.
9. Test database strategy.

Identify any missing entities, unsafe assumptions, unnecessary complexity, or conflicting requirements.

Do not implement anything yet.

Revise the architecture and present:

- Final database model relationships
- Important indexes
- Financial data representation
- Server-side permission boundaries
- Phase-by-phase implementation plan

Wait for my explicit approval.
```

Codex's assessment: this prompt separated architecture review from implementation and made compatibility, exact money, authorization and test isolation explicit gates. It reduced the chance that an attractive UI would conceal an unsafe ledger design.

Prompt 2:

```text
Implement Phase 6 only: Activity History and Audit Logging.

Track:

- Group creation.
- Member joining.
- Member removal.
- Expense creation.
- Expense editing.
- Expense deletion.
- Settlement recording.

For every relevant event store:

- Group ID.
- Actor ID.
- Action type.
- Related resource ID.
- Previous values when applicable.
- New values when applicable.
- Timestamp.

Requirements:

- Expense edits must preserve old and new values.
- Expense deletion must not erase its activity history.
- Members can only view activity for groups they belong to.
- Activity logs must not be editable by ordinary users.
- Create related records within the same database transaction where appropriate.
- Avoid exposing sensitive information in activity metadata.

Test old-value and new-value preservation after multiple expense edits.

Wait for approval.
```

Codex's assessment: this prompt specified both retention behavior and the permission/transaction boundary, then demanded a multiple-edit test. The result could be verified as a snapshot chain rather than accepted from a single event screenshot.

### Current review evidence

Codex reviewed the active monetary, membership, expense, settlement, audit, authentication, migration and permission code. No critical application defect was identified in tested paths; product code, schema and pinned dependencies were left unchanged. Added the requested guarded local demo CLI and one real SQL query-budget regression. Completed documentation and clearly labelled approximately 120-word Part C drafts; these are not represented as the candidate's own reviewed words.

Final observed checks: TypeScript, zero-warning ESLint, 110 unit tests, 138 PostgreSQL integration tests in eight files, production build, Prisma validation, all five empty-schema migrations and a no-difference read-only schema comparison. The query probe measured 8 domain SELECTs for 1 versus 25 expenses and 7 for 1 versus 8 groups, excluding separate auth-client queries. A value-based scan found no configured secret/password matches in 56 browser-build files or 187 tracked files. Full npm audit reported 19 moderate/2 low tooling entries and no high/critical; production-only audit reported zero. No major-version audit fix was applied.

Actual local seed: four generated Better Auth users, two groups, five expenses, four completed settlements, an old/new dinner correction, all four split types and both outstanding/fully settled scenarios. Both group sums were exactly zero; a second run reused records and authenticated the same users. An HTTP smoke probe initially failed on the fourth rapid signin with Better Auth's built-in 429 limit (three signins/ten seconds). Codex spaced verification requests beyond that window without changing the limiter: all four actual accounts then authenticated, their identities matched and 12 protected pages returned successfully, followed by signout. Passwords/cookies were not printed or committed. Actual credentials are in ignored .local/demo-credentials.json. Missing-local-flag, production-mode and test-database seed guard probes rejected before writes. The app was restored locally on port 3000. Verified tooling/test commit: 398a7a0. No deployment, push, video recording, submission, candidate effort or deadline claim is made. See docs/QUALITY_REVIEW.md for PASS/FAIL/NOT IMPLEMENTED/NOT VERIFIED evidence and remaining gates.

## Latest evidence — Phase 7 after explicit approval

The user requested only the dashboard/interface phase with 13 connected screens and server-calculated results. Codex read the installed Next.js data-security/layout guides and applied Next.js, shadcn, React review and verification guidance. Reorganized the long group view into focused routes, added a bounded authorized dashboard activity feed and real quick actions, moved browser expense calculations to a read-only server preview, and supplied settlement form eligibility from the server. Existing financial engines, membership/ownership checks, transaction locks, audit records and save idempotency remain in use. No migration, package installation or subagent was added.

Actual corrections: the first expanded integration run had 133 passes and three failures: a pre-existing HTTP test still requested settlement suggestions on the old group route, and two new tests assumed HTTP 404 before Next.js streamed headers. Updated the settlement test to the dedicated screen without changing its assertions. Denial tests now accept a streamed 200 only with the explicit NEXT_HTTP_ERROR_FALLBACK;404 signal and still check absence of private data and edit controls. The next run had 134 passes and two failures because those tests looked for a rendered custom boundary string before client handling (including a bad quote in the expected fixture text). Switched to the actual streamed not-found signal; 136 passed, then 137 passed after adding server payment-form eligibility coverage. No authorization assertions were suppressed. Browser review also corrected payment history to newest-first and improved summary-card alignment.

Final checks: 110 unit tests, 137 PostgreSQL integration tests across seven files, TypeScript, zero-warning ESLint, production build and all five existing migrations from an empty isolated schema pass. Fourteen new integration cases cover previews, read-only behavior, invalid input, versions, permissions, recent-feed isolation, payment form eligibility and focused HTTP routes. The existing pg adapter deprecation warning remains unsuppressed.

Actual browser flow on isolated localhost:3200: previewed all four split methods; saw a precision error for 50.001/49.999 and corrected it; saved 100.01 BDT in 2:1 shares (66.67/33.34), edited to 200 BDT exact (50/150), inspected/cancelled expense deletion, recorded a 250 BDT Cash fixture payment against a 750 BDT balance and observed 500 remaining, then viewed completed history/activity/dashboard. Mobile 390px testing measured 375px document/scroll widths for dashboard, settings, expense form and balances; the 603px table scrolls internally. Verified invitation entry rejects another origin and connects a generated local invite to the join/accept flow (existing membership replay). Tested desktop at 1440px, saved screenshots, reset viewport, and saw no browser warning/error logs. The fixture group/two accounts were removed using guarded test-only cleanup, the temporary server stopped, and the normal local app restored on port 3000. Code commit: 1c6664e. Phases 5–7 remain local and unpushed; await approval. No candidate-authored personal statements or manual-user verification are claimed.

## Latest evidence — Phase 6 after explicit approval

The user requested activity history and audit logging only. Codex reviewed the existing transactional events, consolidated writes behind a server-only allowlisted writer, added explicit membership and deletion snapshots, removed UI permission flags from new expense metadata, and added an independently authorized paginated history route. New metadata uses version 2; existing version 1 rows are not rewritten. No schema migration, dependency or subagent was added.

Actual correction: the first integration run passed 122 tests and failed one pagination fixture before its assertions, because a reused SQL parameter was inferred as UUID and text. Added explicit casts without weakening pagination checks. The final run passes all 123 integration tests, including three financial edits followed by deletion, exact snapshot-chain preservation, same-timestamp pagination during a newer insert, group isolation, immutable grants, sensitive-field projection and audit-failure rollback. Unit results: 110 passed, including 6 new metadata tests. TypeScript, zero-warning ESLint, production build and all five clean-schema migrations pass.

Browser verification on the isolated localhost:3200 test origin created a 100 BDT expense, edited it to 200 then 300, deleted it and viewed all four retained events. Both old/new comparisons and allocations were visible afterward. Mobile document width stayed within the viewport; the override was reset. The two disposable fixture accounts/group and temporary server were cleaned up; the existing user session was left intact. Code commit: ce08c91. Phases 5–6 remain local on the original branch, not pushed. Domain descriptions/names intentionally remain history; no automatic secret-redaction or database-owner tamper-proof claim is made. See docs/PHASE_6_REPORT.md; await approval.

## Latest evidence — Phase 5 after explicit approval

First completed the user's single-branch request: safely fast-forwarded Phase 4 onto codex/phase-1-auth, pushed it, and removed only the fully consolidated Phase 4 branch. Then implemented only approved settlement suggestions/recording on the original branch. Codex authored a pure greedy planner, bounded exact zero-sum partition DP, independent replay checks, authorized snapshot reads, locked idempotent append-only recording/audit/recalculation and RHF/Zod dialogs. Suggestions never write settlements. No new packages or subagents were used.

Actual corrections: TypeScript caught Object.freeze's generic inference in a test callback; changed it to an explicit arrow. ESLint caught JSX constructed inside try/catch; fetching and rendering are now separate. The owned PostgreSQL process had stopped between turns; its existing data directory was restarted and recovered without a reset. The failed migration-check attempt was rerun successfully. Browser fixtures used only isolated test storage. The older SELECT-only settlement test was deliberately updated to the newly approved append-only privilege contract; UPDATE/DELETE and SQL reference checks remain enforced.

Final results: 104 unit tests (15 new planner tests), 108 PostgreSQL integration tests (29 new settlement cases), TypeScript, zero-warning ESLint, production build and all five clean-schema migrations pass. The exact planner agrees with an independent exhaustive payment-state search on 27 tiny ledgers, the known five-greedy/four-exact counterexample, the ten-member boundary and 1000 generated scenarios. Browser recording reduced a fixture's 600 BDT obligation to 400 after a 200 Bank payment, then zero after a 400 bKash payment, preserving the pre-existing 400 Cash record. The two fixture accounts/group and temporary test server were cleaned up; the normal user session was left intact. Code commit: 3067153. Phase 5 has not been pushed; await approval.

## Latest evidence — Phase 4 after explicit approval

Subsequent publication update: the user explicitly requested another check, commit and push. All 89 unit tests, 79 PostgreSQL integration tests, TypeScript, zero-warning ESLint, production build and four clean-schema migrations passed again. The initial build exited without diagnostic; a fresh captured build passed without changing application code. Pushed the existing Phase 4 commits to `origin/codex/phase-4-balances` and committed these publication notes separately. The phase-completion paragraph below describes the earlier local-only state. No merge, deployment or new financial feature was added.

The user requested group balances only and approval before settlement suggestions. Codex implemented a pure BigInt engine first (29 tests), then an authorized full-ledger reader, current-user totals, per-record/member breakdown and Server Component UI. Added minimal Settlement storage with SELECT-only runtime privileges so persisted payments can participate; no settlement recording or reversal workflow was implemented. Full-ledger zero-balance removal replaced the earlier conservative involvement guard. Existing inactive-history correction checks remain. No subagents or new dependencies were used.

The supplied examples had two conflicts, identified before implementation: scenario 1's B/C shares imply different nets from its expected result; scenario 2's stated BDT amount is ten times the listed poisha expectations. Both interpretations are separately tested. The engine follows persisted amounts and allocations. Initial test discovery failed because Vitest's %j test-name formatter attempted BigInt JSON serialization; changing only that test label fixed discovery. No monetary rule or global BigInt JSON behavior was changed to conceal the issue.

Actual final evidence: 89 unit tests, 79 real PostgreSQL integration tests, TypeScript, zero-warning ESLint, production build and all four migrations from an empty isolated schema pass. The new integration tests include a committed expense edit during a repeatable-read snapshot, corrupt-ledger failure UI, complete-ledger pagination independence, settlement signs, cross-group totals, authorization and settled-member history guards. Browser checks on the separate localhost:3200 test origin showed +600/−600 BDT after a 400 BDT recorded settlement on a 1000 BDT expense; the mobile table remained inside its container. The two browser accounts/group and temporary server were cleaned up. The normal user session was left intact. Phase 4 local code commit: c80d6ab; it has not been pushed. Phases 1–3 were previously pushed under explicit user authorization. See docs/PHASE_4_REPORT.md; await approval before further work.

## Latest evidence — Phase 3 after explicit approval

The user required the pure split engine and critical tests before UI, and expressly excluded balances. Codex implemented BigInt codecs and independent equal/exact/percentage/shares functions first; 42 focused tests passed before persistence/UI work. It then added the expense/split migration, authenticated creator/admin services/actions, transaction/audit history, retries/versions and RHF/Zod responsive forms. No subagents were used or new packages installed.

Actual corrections: TypeScript caught Vitest array-row spreading in invalid-member tests; object rows now exercise the intended arrays. The first PostgreSQL run exposed Prisma nested composite-relation validation errors (19 expense failures, 38 passing tests). Explicit split writes inside the transaction fixed them. Review removed a duplicate currency prefix and named DTO money amountPoisha. A traced pg deprecation warning originates in Prisma adapter relation queries and remains documented without suppression.

Final evidence: 60 unit tests (43 split/codec, with 2,000 generated scenarios across four methods), 59 PostgreSQL integration tests (25 expense, 20 group, 14 auth), TypeScript, zero-warning ESLint, production build and all three migrations from an empty isolated schema pass. Browser checks on separate localhost:3200 test storage exercised all four methods, edit/delete, precision rejection, excluded payer and mobile layout. The three browser accounts/group were cleaned up; the existing user session was not changed. Conservative removal blocks live payer/positive-allocation involvement until balances are approved; inactive-history corrections preserve contribution. See docs/PHASE_3_REPORT.md. No balance/settlement implementation, publication or candidate-authorship claims were added. Await approval.

This log describes this Codex session. It is not a claim that the candidate independently wrote or reviewed the code. The assessment requires the candidate to understand and explain their submission.

## Setup

Codex read the supplied assessment PDF, inspected the initially empty local repository, authored the reference Next.js app, used npm/PostgreSQL locally, checked official Next.js/Better Auth/Prisma references, and exercised the localhost interface through browser automation. No subagents were used. Skills used where relevant: PDF review, Next.js, PostgreSQL best practices, Sites workflow guidance, React review, verification and plugin discovery. The assessment's explicit Next.js/Node/PostgreSQL requirements took precedence over Sites hosting's Worker-specific stack.

When the user supplied the master development instructions, implementation stopped and an architecture approval phase began. The proposed stack migration has not been executed.

## Actual mistakes and how they were found

1. The generated Drizzle read transaction configuration used `readOnly: true`, an invalid API option. Strict TypeScript caught it. It was corrected to `accessMode: 'read only'`; type checking then passed.
2. The first generated database scripts used top-level await without declaring package ES module mode. Running the migration produced “Top-level await is currently not supported with the cjs output format”. Adding `type: module` fixed script execution. Migration and seed subsequently succeeded.
3. The initial departure policy checked only that a member had zero balance at removal. Reviewing the lifecycle exposed that a later historic expense edit could reopen that former member's debt. The reference service now blocks editing/deleting an expense involving inactive members until rejoin. Additional HTTP regressions were written but have not run yet; do not count them as verified.

Also encountered: Turbopack could not create junctions in this Windows sandbox, so Webpack was selected; PostgreSQL background process handling needed a retained foreground process for successful verification. These were environment issues, not financial feature successes.

## Actual user prompts

The initial instruction was exactly:

> according to this instruction please do all the things

It provided broad authorization to build from the attached PDF but did not specify implementation phases. It was not a particularly precise prompt; the PDF supplied the functional detail.

The second substantive instruction was the full user-authored **FAIRSHARE - MASTER DEVELOPMENT INSTRUCTIONS** pasted attachment. Its exact contents are retained in `docs/prompts/master-development-instructions.txt`. It specified stack, invariants, review gates and the first architecture-only task. It improved the process by making those boundaries explicit. This is a whole-prompt reference, not a fabricated reconstructed interaction.

There are no additional historical “best prompts” or human correction conversations to invent. The candidate can assess these two real prompts and append their own later prompts as they actually occur.

## Work deliberately written by the candidate

None has been identified in this session. Codex authored the current source and proposal documents. Before submission, the candidate should personally implement/review a bounded piece, record exactly what they wrote and why, and revise the Part C answers into their own words. This section must not claim that AI-written work was manually authored.

## Verification history

### Architecture review, 4 November 2026

At the user's explicit request, reviewed all nine architecture areas without implementation. Inspected installed package/adapter metadata and official guidance, read npm metadata for Prisma 7.10.1 without installing it, and revised planning/schema proposals. Found unpinned Prisma selection, missing auth cookie handling, removed-user rejoin risk, overbroad historical freeze, missing payment correction, overstated DB constraints and insufficient test/shadow isolation. The revised design adds states, inactive-member delta checks and a narrow full-settlement reversal. No application code/dependency/database changes or new runtime tests were made during this review. Schema CLI validation and the target auth integration remain gated on approval.

TypeScript and 12 unit tests pass, including 4,000 generated split cases. An earlier Webpack production build and 42 real-auth/PostgreSQL HTTP assertions passed. Browser verification created an expense of BDT 100 with allocations 33.34/33.33/33.33. The current proposal is not implemented or Prisma-validated. ESLint is not installed. Latest former-member HTTP regression checks remain pending. Update this log with actual new evidence after each approved phase.

### Phase 1 implementation after explicit approval

The paragraph above describes the earlier reference build, now archived. Phase 1 replaced the active app with auth-only Prisma/Better Auth functionality, Tailwind/shadcn/RHF forms and the responsive protected shell. Domain code/data was preserved; no group management was started. Prisma auth migration was applied to new clean dev/test DBs. Actual current results: 13 unit tests, 14 real PostgreSQL/HTTP integration tests, TypeScript, zero-warning ESLint and production build pass. Browser Server Action checks verified signup/signin/incorrect-password/signout, session persistence and mobile navigation.

Important correction: initially attributed an expired-session HTTP 200 to possible streaming; inspection disproved that hypothesis. The actual Prisma pg timestamptz conversion under a non-UTC DB connection refreshed an expired session. Added explicit UTC startup configuration and retained the regression; it passes. A test's attempted Prisma.dmmf introspection was also unsupported by the selected generator, so it now compares Better Auth's own required field contract to the schema, complemented by actual migration/HTTP tests. shadcn-generated font configuration was corrected to avoid a circular CSS variable and external font dependency. ESLint 10's peer conflicts led to a documented compatible ESLint 9 selection, without disabling rules.

No claim of candidate-authored implementation or new personal reflection is made. Full phase evidence and limitations are in docs/PHASE_1_REPORT.md. Await explicit approval before additional work.

### Phase 2 groups and authorization after explicit approval

The user explicitly defined Phase 2 as Group Management and Authorization, replacing the earlier financial-phase numbering. Implemented only that scope: additive group/membership/audit schema, authenticated server services/actions, hashed expiring invitations, group list/details and admin controls. Financial work was not started. Tests use real PostgreSQL and real Better Auth cookies; production actor identity is never posted by the client.

Actual correction: the first test-fixture design repeatedly called public signup/get-session HTTP endpoints, triggering rate limits and cascading failures. Replaced fixture provisioning/session resolution with Better Auth's trusted API, matching production server-service checks. Did not disable or increase production limits; the HTTP auth regressions still run separately. A migration-generation shell quoting error was corrected before application. Current evidence: 17 unit tests, 34 integration tests (including a real waiting-join/revocation race), TypeScript, zero-warning ESLint and production build pass. Browser Server Actions created a group, issued an invite, preserved it through signup and joined as MEMBER with restricted controls. The browser's subsequently changed session was left alone. See docs/PHASE_2_REPORT.md; await approval.
