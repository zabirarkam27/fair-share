# FairShare

Shared expense management for flatmates, friends and trips.

**Current status:** architecture approval requested. The working reference implementation predates the latest master instructions. It uses Drizzle/Route Handlers/custom CSS/Node tests; the proposed target uses Prisma/Server Actions/Tailwind/shadcn/React Hook Form/Vitest. Do not describe the migration as complete.

Start the review with [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md), [plan.md](plan.md) and the inactive [Prisma schema proposal](prisma/schema.proposal.prisma). Project workflow rules are in [AGENTS.md](AGENTS.md).

## Running the existing reference build

Prerequisites: Node.js 22.13+ or 24, npm, PostgreSQL. No starter template was used; the reference app was authored in this session.

```sh
npm ci
```

For an installed local PostgreSQL distribution, `npm run db:local` initializes an isolated cluster under ignored `.local/`, binds it to 127.0.0.1:55432 and writes random development credentials to ignored `.env.local`. On Windows it defaults to PostgreSQL 18 under Program Files; set `PG_BIN` to your PostgreSQL bin directory when different. The command refuses to overwrite an existing environment file when initializing a new cluster.

Alternatively, use `docker compose up -d db`, copy `.env.example` to `.env.local`, use the compose development URL and set a random authentication secret. Never use the example database password in production. Avoid starting Docker and the local cluster simultaneously on the same port.

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. Use this exact origin for cookies and Better Auth configuration. These are current reference-build SQL/Drizzle commands, **not** the proposed Prisma commands. Do not apply `schema.proposal.prisma` to the current database.

Demo accounts are `rafi@fairshare.demo`, `nusrat@fairshare.demo`, `tanvir@fairshare.demo`, and `mahi@fairshare.demo`, each with development password `FairShareDemo!2026`. The seed includes flat/trip groups and all four split modes. Seed scripts skip existing demo groups. The local browser smoke check additionally created one shared-tea expense; seeds are not a destructive reset.

`npm run db:stop` stops the owned local cluster. In restricted Windows sandboxes a retained foreground PostgreSQL process may be required; the normal pg_ctl background launch was unreliable here. Webpack is explicitly selected because Turbopack's junction creation was blocked by the sandbox.

## Existing checks and limits

```sh
npm run typecheck
npm test
npm run build
```

The existing `npm run test:integration` script starts real auth sessions and creates disposable fixtures in the configured database. It passed 42 HTTP assertions earlier, but it does **not** meet the new dedicated-test-database requirement. Do not run it against production. It will be replaced with a guarded isolated PostgreSQL/Vitest setup after approval. The subsequent former-member regression additions have not yet been executed. ESLint is not configured. See ARCHITECTURE.md for the precise verification baseline.

## Intended deployment (after approved migration)

Deploy the Node-runtime Next.js app to a supported Node host with external PostgreSQL. Configure DATABASE_URL, a long random BETTER_AUTH_SECRET, the public HTTPS BETTER_AUTH_URL, appropriate trusted origins and secure cookies. Apply reviewed production Prisma migrations in a controlled release step before starting the app. Use pooled database connections where appropriate, never expose PostgreSQL to browsers, and do not seed public demo credentials into private production accounts. Confirm backups, external/shared rate limits and email recovery/verification before calling a deployment production-ready.

No live deployment, public GitHub publication or assessment-form submission has been performed. Final setup/deployment instructions, candidate-reviewed AI log/answers and recording are phase 6 deliverables, not completed claims.
