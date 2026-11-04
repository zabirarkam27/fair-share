<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FairShare project rules

The user-authored master development instructions received on 4 November 2026 govern this repository. Current work is phase 0: architecture/proposal only. See ARCHITECTURE.md, DECISIONS.md and plan.md.

## Approval workflow

- Do not implement/refactor, install dependencies, apply a Prisma migration, publish, or start the next phase until the user approves that phase.
- After each approved phase, run TypeScript, ESLint and relevant tests; review security implications and the diff; report changes, evidence, limitations and next phase; then wait for approval.
- Preserve existing source/data. The existing Drizzle/Route Handler build predates the master instructions; it is a reference baseline, not evidence that Prisma/Server Actions have already been implemented.
- Make small, meaningful commits after checks. Never commit secrets, environment files, local database contents or tokens. Do not fabricate a historical commit sequence.

## Implementation invariants (for approved phases)

- Required target: Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Lucide, React Hook Form, Zod, PostgreSQL, Prisma, Better Auth, Vitest. Server Actions call feature services for mutations.
- Derive actor identity from a fresh server session. Recheck membership/role/ownership/resource group within every operation. UI visibility is never authorization.
- Pure money functions use BigInt poisha; percentage basis points; positive integer share weights. DTOs carry decimal strings. Never use decimal floating-point calculations or patch BigInt.prototype.toJSON globally.
- Persist exact allocations. Every expense's allocations equal its total; all group balances sum to zero. A failed invariant must fail visibly.
- Lock the group consistently before writes. Use transactions for ledger changes and immutable activity. Require edit versions and settlement request keys.
- Retain departed membership and history. Block nonzero-balance departure and historical changes that would strand former members.
- Distinguish LEFT from REMOVED. Removed members require explicit admin reactivation. Historical edits/deletes/payment reversals must have zero financial delta for every inactive member; do not blanket-block harmless description edits.
- Reviewed target versions and remaining compatibility gates are in ARCHITECTURE.md. Static compatibility evidence is not runtime verification. Read the reviewed design rather than the superseded archive.
- Test real constraints/locking against dedicated PostgreSQL test storage, never production or the demo database. No SQLite stand-in for integration tests.
- Keep secrets/database clients out of client components. Do not disable checks, use @ts-ignore or alter tests merely to conceal a failure.
- Record actual AI use and errors. Never invent prompts, human-written work, personal opinions, elapsed effort or verification results. Candidate-authored responses require candidate review.
