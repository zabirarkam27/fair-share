# Phase 7 — Dashboard and User Interface

Implemented only the user-approved dashboard/interface phase. Code commit: `1c6664e` on the existing `codex/phase-1-auth` branch. No new dependency, database migration, reversal workflow, deployment or publication. Phases 5–7 remain local pending review.

## Connected screens

Paths below use `/dashboard/groups/[groupId]` as the group base.

| Requested screen | Route and working behavior |
| --- | --- |
| Dashboard | `/dashboard`: owed/receivable totals, individual group balances, latest eight authorized events, choose-group Add expense, Create a group, invitation entry |
| Groups list | `/dashboard/groups`: active memberships, member counts/roles, creation and join entry |
| Group details | Group base: description, financial overview, latest five expenses and links to focused features |
| Expense list | `/expenses`: saved amounts/splits, detail/edit links, confirmed deletion and existing 25-item pagination |
| Add expense | `/expenses/new`: description, BDT amount, date, payer, included members, four split methods, server preview, save/cancel |
| Edit expense | `/expenses/[expenseId]/edit`: saved input defaults, creator/admin access, version-checked save, server preview/cancel |
| Expense details | `/expenses/[expenseId]`: persisted allocations, original split inputs, payer/author/version, permission-controlled edit/delete |
| Balance overview | `/balances`: existing complete-ledger balance service, current-user totals, member breakdown, per-record contributions, visible zero-sum verification |
| Settlement suggestions | `/settlements`: existing exact/greedy plan labels, completed-payment recording, partial payment, error and success feedback |
| Settlement history | `/settlements/history`: completed payments newest-first, parties, amounts, bKash/Cash/Bank labels and Dhaka timestamps |
| Activity history | `/activity`: existing protected keyset history, immutable before/after snapshots, shared group navigation |
| Group settings | `/settings`: member roles/status, admin invitation issue/copy/replace/revoke, confirmed removal and exact-name-confirmed group deletion |
| Join group | `/dashboard/join` validates a same-origin invite URL, then `/join/[token]` uses the existing signin/accept flow |

There are no unsupported rename, role-transfer, payment-reversal, simulated chart, export or notification controls. Existing features are reused rather than represented by fake buttons.

## Financial and permission boundaries

- All balances and payment suggestions continue to come from persisted records through the existing server engines. Formatting uses the shared BigInt-safe BDT formatter; DTO money remains decimal-string poisha.
- Browser expense calculations were removed. Preview split invokes a Server Action and `expenses.preview`, which reuses the same financial/member validation as save in a RepeatableRead transaction. It authenticates independently, verifies active membership, payer/participants, inactive historical deltas and, for edits, ownership/admin authority plus version. It writes neither expenses nor audit events.
- Equal inputs need no per-member numbers; exact inputs are BDT amounts; percentages allow at most two decimals and must sum to 100%; weighted shares require positive whole weights. The server returns the allocations and all validation errors.
- A new expense preview uses a provisional seed. Final server-assigned IDs can rotate equal rounding ties differently by one poisha; the UI explains this and displays the actual persisted result after save. Edits use the existing ID, so preview/save rounding remains stable.
- Settlement form eligibility/options are derived on the server from current balances and the session actor. The browser does not recompute outstanding limits or payment plans. Recording still independently rechecks both outstanding bounds, active same-group members and involved-party/admin permissions under the existing group lock, transaction and idempotency key.
- Every focused page uses authorized services; the shared layout is not the sole security boundary. Cross-group expense IDs and unauthorized edit routes are unavailable. Actor IDs/roles are never accepted as client authority.
- Dashboard recent activity filters active membership and live groups in its database query, returns at most eight event headers, and exposes no metadata, email, request key, invite token or hash. Detailed history retains its separate authorization and sanitization.

## Responsive and accessible behavior

The interface uses a restrained green/neutral fintech palette, shared cards/buttons and Lucide icons. Desktop sidebar navigation becomes an accessible mobile sheet. Group navigation and financial tables scroll in their own containers. Forms have associated labels, native controls, visible focus, fieldsets, status/error announcements and pending controls. A workspace loading skeleton, dashboard error boundary, unavailable-page boundary, per-feature empty states and success notices cover non-happy paths. Destructive actions use explicit confirmations; expense deletion is styled as destructive. No animation or dependency was added.

## Actual verification

| Check | Final result |
| --- | --- |
| `npm test` | **110 passed**, 9 files |
| `npm run test:integration` | **137 passed**, 7 files; real Better Auth sessions and isolated PostgreSQL |
| New Phase 7 integration coverage | **14 passed** |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed; all focused routes listed in the production build |
| `npm run test:migrations` | All **5** existing migrations passed from an empty isolated schema |
| Diff/security review | Passed; no environment files, tokens, local DB contents or generated artifacts staged |

The new tests cover every split preview, exact conservation/serialization, read-only behavior, invalid input/precision, outsider/anonymous/cross-group rejection, creator/admin preview permission, stale versions, stable edit preview/save, server payment-form eligibility, removed/deleted-group recent-feed exclusion, focused HTTP access, private-data denial and dashboard/join routing. Existing auth, membership, financial, concurrency, audit, idempotency and immutability tests remain in the full suite.

Actual intermediate failures were test assumptions, not ignored application results: first run **133 passed / 3 failed**, then **134 passed / 2 failed**. A prior settlement HTTP test was updated to its new `/settlements` location, retaining all assertions. New denial tests originally assumed an immediate HTTP 404/custom rendered boundary. Next.js can stream HTTP 200 headers before `notFound()` resolves; the corrected tests require the explicit `NEXT_HTTP_ERROR_FALLBACK;404` signal for such responses and continue asserting no private group/expense data or edit form. One interim expected quote was also corrected. The suite then passed 136/136, and the additional eligibility case raised the final total to 137/137. No tests were disabled or authorization checks weakened.

## Browser evidence

Used only disposable accounts/group in `fairshare_test`, served on isolated `localhost:3200`:

1. Dashboard Add expense opens a group picker and the dedicated form. Loading state was observed on navigation.
2. Previewed equal, exact, percentage and 2:1 shares. Invalid `50.001/49.999` percentages showed the server precision error; `50.25/49.75` corrected it.
3. Saved ৳100.01 weighted 2:1 as ৳66.67/৳33.34. Detail screen showed the saved inputs/allocations and success feedback.
4. Edited to ৳200.00 exact ৳50.00/৳150.00; detail showed version 2 and the persisted result. Opened/cancelled the delete confirmation.
5. The fixture's existing ৳600 obligation plus the new ৳150 allocation yielded a ৳750 suggestion. Recording a ৳250 Cash test payment showed success and ৳500 remaining. Payment history retained the pre-existing ৳400 Cash payment and the new record; final ordering is newest-first.
6. Navigated balances, activity and settings. Mobile navigation opened and closed while routing correctly. Invitation entry rejected another origin, then accepted a generated same-origin link and connected to the existing-member accept/replay flow.
7. Tested desktop at 1440px and mobile at 390px. Mobile document and scroll widths both measured 375px on dashboard/settings/form/balances; the approximately 603px balance table stayed in its scroll container. Dynamic form inputs fit the mobile card. Browser warning/error logs were empty.

Local screenshots: `artifacts/phase7-dashboard.png` and `artifacts/phase7-mobile-form.png` (ignored artifacts, not committed). The viewport override was reset. Guarded cleanup removed only the two Phase 7 test accounts and their group. The temporary test server stopped, and the normal local app was restored on port 3000. No user data was reset.

## Limits and approval gate

This was targeted keyboard/label/viewport inspection, not a comprehensive assistive-technology audit. The existing full-ledger balance read is reused for payment history, so that screen is not independently paginated. Recent dashboard events are deliberately bounded; full activity uses existing pagination. Group settings exposes only already implemented management operations. Existing production readiness limits, including password recovery/verification, distributed abuse protection and the unsuppressed Prisma/pg deprecation warning, remain documented in README/architecture. No unrelated upgrade was attempted.

Phase 7 is complete locally. Wait for explicit approval before publication or further feature work.
