# Actual AI usage log (in progress)

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
