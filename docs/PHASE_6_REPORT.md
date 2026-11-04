# Phase 6 — Activity History and Audit Logging

Implemented under explicit Phase 6 approval on 4 November 2026 (Asia/Dhaka). Code commit: `ce08c91`, on the existing `codex/phase-1-auth` branch. Phases 5–6 remain local and unpushed. No new phase, reversal workflow, dependency, schema migration or deployment was added.

## Actual results

| Check | Result |
| --- | --- |
| Unit suite | 110 passed in 9 files (6 new metadata + 104 retained) |
| Real-session PostgreSQL integration | 123 passed in 6 files (15 new activity + 108 retained) |
| TypeScript | Passed (`npm run typecheck`) |
| ESLint | Passed, zero warnings (`npm run lint`) |
| Production build | Passed; protected activity route included |
| Prisma | Client generated successfully; existing schema unchanged |
| Clean migration chain | All 5 existing migrations passed in a new isolated schema |
| Browser | Creation, two edits, deletion and retained old/new comparisons verified; mobile containment checked |

Ignored evidence: artifacts/phase6-build.log, artifacts/phase6-integration.log, artifacts/phase6-activity.png. The normal app is running at 127.0.0.1:3000.

## Event coverage and stored fields

The existing Activity table already stores non-null group ID, actor ID/name, action type, related resource ID and timestamp, with optional JSON before/after values and metadata schema version. Its group/timestamp/ID index supports the history read. All application audit inserts now use one internal server-only writer, called with the same Prisma transaction as the related domain mutation.

| Required event | Action | Snapshot behavior |
| --- | --- | --- |
| Group creation | GROUP_CREATED | New name/description; actor is the authenticated creator |
| Member joining | MEMBER_JOINED | New member ID/name/role/status/join/departure state; previous state when an existing LEFT membership rejoins |
| Member removal | MEMBER_REMOVED | Full prior ACTIVE state and new REMOVED/departure state |
| Expense creation | EXPENSE_CREATED | Initial expense and saved split snapshot |
| Expense editing | EXPENSE_UPDATED | Complete previous and new expense values and allocations |
| Expense deletion | EXPENSE_DELETED | Previous live snapshot and new version/deletedAt marker, with retained allocations |
| Settlement recording | SETTLEMENT_RECORDED | Saved payment ID/group, sender/receiver, recorder, amount, method and recorded timestamp |

Existing group-deletion/invitation events remain supported. Group deletion now has before/after values; invitation events include only active/expiry state, never raw tokens, hashes or links. Idempotent joins, expense creates and settlement retries retain their existing no-duplicate-event behavior.

Expense snapshots retain ID/group, description, amountPoisha, date, payer/creator IDs and display names, split type, optimistic version, deletedAt state and every saved split's member ID, amountPoisha and original inputUnits. Monetary JSON fields are decimal integer strings; raw BigInt is never serialized globally. The old canManage UI flag is not part of version 2 snapshots.

## Multi-edit/deletion preservation test

The critical PostgreSQL test creates v1 and performs three edits:

1. v1: BDT 100, equal split between A/B.
2. v2: BDT 120, changed date/description/payer, exact allocations A 20/B 100.
3. v3: BDT 150, changed date/description/payer, percentage inputs 50.25/49.75 and persisted rounded allocations.
4. v4: BDT 200, changed date/description/payer, shares 2:1:1 across A/B/C.
5. Deletion: v5 with a timestamp, retaining the v4 amount, original inputs and allocations.

Each edit's before snapshot exactly equals the prior captured version and its after snapshot exactly equals the new version, including split values/inputs. The creation event remains unchanged. After deletion, all four earlier audit DTOs are compared to their saved copies and remain identical. The fifth event retains the complete v4 before snapshot and explicit deleted v5 after snapshot. This checks persisted JSON and the authorized reader, not mutable references or only the latest expense row.

## Authorization, immutability and atomicity

The list service resolves a verified Better Auth session and strictly accepts only a group ID and optional cursor. It independently checks current ACTIVE membership in a live group inside a RepeatableRead transaction. Ordinary active members may view that group's history; outsiders, anonymous callers and removed members cannot. Deleted groups retain database history but no longer expose the ordinary live-group history route. Actor/role/metadata overrides are rejected rather than trusted.

There is no public audit create/edit/delete Server Action or Route Handler. The runtime role remains a non-owner with SELECT/INSERT only on Activity; UPDATE, DELETE and TRUNCATE are revoked. Group admins have no audit-edit interface either. Tests verify all three prohibited database operations fail. This is ordinary-user/runtime immutability, not protection from the separate database owner/maintenance role.

The shared writer receives the authenticated actor and the caller's transaction. An audit insertion/projection failure rolls back the resource mutation too. New tests revoke Activity INSERT and verify failed join/removal, expense edit/deletion and payment recording leave membership, expense/splits and settlements unchanged. Retained earlier suites also verify group/expense creation rollback. No history rewrite or backfill was performed.

## Metadata privacy and compatibility

Per-action Zod object schemas strip unlisted properties, including nested split properties, before persistence. The read boundary projects again, including legacy rows, so stored JSON is never passed through blindly to the UI. Profile emails, passwords, auth/session tokens, invitation tokens/hashes/URLs, request keys/fingerprints and UI permission flags are excluded from these application-selected metadata fields.

New writes explicitly use schemaVersion 2. Version 1 rows remain intact and are projected with compatible optional fields. Malformed or unsupported-version metadata is hidden with an unavailable-snapshot message, while permitted event headers remain visible. The server-rendered UI uses escaped text and structured fields, not a raw JSON dump or HTML injection.

Tests verify unknown sensitive fields are stripped before persistence and legacy extra fields disappear from both DTOs and HTTP output. Actual new expense/settlement events are scanned against fixture emails, invite token/hash, request key and fingerprint values. Historical actorName remains unchanged even after the actor's profile name is changed. Participant names may be resolved from the scoped current/former-member roster; immutable participant IDs and financial values remain canonical.

User-written descriptions and names intentionally remain in history, even after resource deletion. This is not automatic secret detection/redaction for arbitrary text, nor a data-erasure feature. Retention and account-deletion policies still require future operational decisions.

## History route and pagination

Group pages link to `/dashboard/groups/[groupId]/activity`. Each page shows at most 25 records, ordered by createdAt descending and ID descending, with a timestamp/UUID cursor for older entries. Both authorization and related name lookup occur in one consistent read transaction with finite wait/time limits. Cursor positions do not grant permission and are always combined with the authorized group ID.

The pagination test creates 30 equal-timestamp records, captures the first page, inserts a newer event, then reads the next page. It verifies exact expected ordering, no duplicates/missing original rows and no false next page. Another group's cursor cannot expose its records. The UI shows action, frozen actor name, Dhaka timestamp, resource ID and structured old/new values, including original split inputs and final poisha allocations.

## Browser evidence and correction log

On the isolated localhost:3200 test origin, a disposable account created “Audit history example” for BDT 100, edited it to 200 then 300 and deleted it. The history page retained creation, both edits and deletion. Expanded comparisons displayed 100→200 (allocations 50→100 each) and 200→300 (100→150 each) after deletion. The saved screenshot shows the retained deletion event above the 200/300 comparison. At a 390px viewport, snapshot panels stacked within the page; measured document width was 375px and panel width 293px, so there was no horizontal page expansion. The temporary override was reset. Both fixture accounts/group and the temporary test server were cleaned up; the existing user session was not changed.

The first integration run passed 122 tests and failed one fixture insertion before pagination assertions: a reused `$2` SQL parameter was inferred as UUID and text. Explicit UUID/text casts fixed the fixture; the full suite then passed 123/123. No assertions were weakened or critical failure committed. The existing Prisma/pg deprecation warning remains documented and unsuppressed; no dependency upgrade was attempted.

## Approval boundary

The schema/financial engines and existing permission rules were not broadened beyond audit capture/history. Phases 5–6 are committed locally on the original branch, not pushed. Further features, reversals, deployment/publication, retention automation and operational hardening require separate approval. Await user review.
