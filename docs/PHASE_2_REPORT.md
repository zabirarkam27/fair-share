# Phase 2 — Group Management and Authorization

Implemented 4 November 2026 (Asia/Dhaka). The user's latest scope defines Phase 2 as groups and authorization, superseding the older plan's phase numbering. No expense, balance, splitting or settlement implementation was started.

## Features and boundaries

- Create a group and its initial ADMIN membership atomically.
- List only live groups where the verified user has ACTIVE membership.
- View group details and roster through independently authorized server-only service operations.
- Admin-issued seven-day invitation links: 32 random bytes, base64url, only SHA-256 hash stored, shown raw once on creation. Rotation and explicit revocation supported.
- Join explicitly after authentication; login/signup preserves only a format-validated invite token and returns to its fixed local join route. GET/prefetch never joins, and the unauthenticated page reveals no group metadata.
- Unique composite membership key and group-row serialization prevent duplicate and concurrent duplicate memberships; repeated acceptance is idempotent and does not duplicate history.
- Admin-only removal retains a REMOVED membership and immediately denies subsequent server access. A valid invite cannot undo removal.
- Admin-only deletion soft-deletes the group, revokes its invitation and records the event in one transaction; lists/reads/joins deny deleted groups. Exact-name confirmation is required.
- Existing admin cannot remove themselves. Role transfer, leave and reactivation UI are outside this requested phase.

All actor identity comes from Better Auth's server session. Client `userId`/`role` overrides are rejected by strict schemas. `memberId` is only a target selector and is rechecked inside the authorized group. Non-members and nonexistent groups receive the same not-found result; roles are checked only after membership is established. UI visibility is not the permission boundary.

Every existing-group writer takes a group-row FOR UPDATE lock, then re-reads membership/group state. Joining rechecks token hash, expiry and deletion after locking, so rotation/revocation cannot be bypassed by an earlier lookup. Multi-query reads use a consistent snapshot. Database exceptions roll back group/membership changes and their audit event together.

## Data and migrations

Migration `20261104000200_groups` adds Group, GroupMember and append-only Activity models. It includes unique invitation hashes, a composite membership PK, membership lookup/feed indexes and a SQL partial unique index allowing at most one active admin. The existing Phase 1 auth migration is unchanged. Both dev and isolated test databases applied the additive migration successfully; subsequent migrate-deploy runs are idempotent.

Runtime grants allow SELECT/INSERT/UPDATE for groups and memberships, SELECT/INSERT only for Activity, and no Activity UPDATE/DELETE/TRUNCATE. Group/user historical references use restrictive foreign keys. No raw invitation is stored in a database column or audit snapshot, and DTOs omit hashes and auth records. The full financial schema remains inactive.

Main changes: prisma/schema.prisma, the additive migration, scripts/grant-runtime.mjs, src/features/groups/, group list/detail/join pages, workspace navigation, and the small auth changes needed for invitation return. Existing local demo/auth data is retained. The database keeps its established `fairshare_phase1` name; no rename or reset was necessary.

## Verification results

| Check | Result |
| --- | --- |
| Prisma schema validation and client generation | Passed |
| Additive dev/test migrations and scoped grants | Passed |
| TypeScript and generated route types | Passed |
| ESLint, zero warnings | Passed |
| Unit suite | 17 passed, 5 files |
| PostgreSQL integration suite | 34 passed: 20 group/security tests + 14 auth/protected-route regressions |
| Production build | Passed |
| Production dependency audit | 0 findings at the final check |
| Browser Server Action flow | Create group → issue invite → sign out → invitation login/signup → explicit acceptance → MEMBER roster/controls verified |

The eight requested tests map to:

1. Private-group detail and own-group listing isolation.
2. Independent roster boundary rejects a changed group ID; protected HTTP page omits private group/member metadata.
3. Normal member removal attempts fail and target remains active.
4. Normal member group deletion fails and group remains available to admin.
5. Admin removal succeeds; removed user's reads/list access disappear.
6. Valid invite joins with MEMBER role; raw token differs from persisted hash and hashes do not appear in DTOs.
7. Malformed, unknown, rotated, revoked and expired invites fail; deleted groups and removed users cannot use a link.
8. Sequential and concurrent acceptance produces one membership and one join event.

Additional checks prove anonymous denial, rejected actor/role overrides, admin-only invite operations, cross-group target rejection, retained soft-deletion history, immutable audit grants and creation rollback if audit insertion fails. A coordinated test holds the actual PostgreSQL group lock, observes a waiting join, revokes the token before commit and verifies the join is rejected after locking.

The group integration fixture resolves real signed cookies through Better Auth's trusted server API. It does not mock identity or weaken auth. The first fixture design used public signup/get-session HTTP requests for every service call and hit rate limits, causing failures; moving fixture setup/session resolution to the same trusted API path as server code corrected the harness. The separate HTTP auth suite still runs with production auth rate limits unchanged. A shell-quoting failure while generating migration text was corrected before any migration application; no incomplete migration was applied.

## Browser evidence

Local ignored screenshot: artifacts/phase2-member.jpg. The browser check created `The Dhanmondi flat` with Rafi Demo as admin, then registered Nusrat Demo and accepted its invitation as MEMBER. The member view exposes no invitation, removal or deletion controls. Admin operations and adversarial payloads are verified through the real PostgreSQL service tests, beyond simply hiding controls. A later change of browser account/session was left untouched; no unrelated user account or group was modified.

These local demonstration accounts are not production secrets. The raw demo invitation is not copied into tracked documentation or screenshots. No deployment, public repo push or assessment submission was performed.

## Limits and next gate

- No financial tables/writes exist. A mandatory zero-net-balance guard must be integrated into removal before any future expense/settlement phase is enabled. This phase does not pretend to calculate balances.
- One current reusable invitation per group; generating a new one revokes the previous one. Raw links cannot be recovered from hashes.
- Removed members cannot self-rejoin; admin reactivation/role transfer/leave UI requires a later approved scope.
- Group deletion retains records/history and is not data erasure; retention policy remains a production decision.
- Shared join throttling and external access-log/token redaction remain deployment requirements. The application does not log raw tokens, and Referrer-Policy is no-referrer; development tools/browser history and infrastructure access logs still need care. No distributed abuse-protection claim is made.
- Phase 1's email recovery/verification and lint/dev-tool maintenance limits remain documented. Not a production-readiness claim.

Wait for explicit approval before additional phases or financial implementation.

Local implementation checkpoint: `5278d92`. No remote push or publication was performed.
