# Version Deviations from Specification

This document tracks intentional deviations from the MVP specification's recommended stack, with rationale and migration paths.

## 1. Next.js 16 instead of 14

**Spec reference:** §9.1 — "Next.js 14+ (App Router)"

**Current version:** Next.js 16.2.7

**Rationale:**
- `create-next-app@latest` installs the latest stable release (16.x as of 2026-06-08).
- The App Router API used in this project (Route Handlers, Server Components, Server Actions, `next-auth` v5 integration) is backward-compatible across 14/15/16.
- No features used in Mission 1 depend on 16-specific APIs.

**Risk:** Low. If a future library incompatibility arises, downgrading is straightforward (see assessment below).

### Downgrade assessment: Next.js 16 → 14

**Cost: High. Not recommended.**

Downgrading from 16 to 14 is technically possible but carries significant friction:

1. **React 19 → React 18.** Next.js 16 ships with React 19.2. Next.js 14 ships with React 18. Downgrading requires React 18, which would break `shadcn/ui` components generated for React 19 (the latest shadcn/ui release uses React 19 APIs like `useFormStatus` changes and `ref` as prop patterns). Regenerating all shadcn components would be needed.

2. **NextAuth v5 compatibility.** Our `next-auth@5.0.0-beta.31` is tested against Next.js 15+. While v5 technically supports Next.js 14 App Router, the middleware pattern (`auth()` export in `middleware.ts`) was refined for 15+. Testing would be required.

3. **Turbopack.** Turbopack is stable and default in 16 (experimental in 14). Our `pnpm dev` script relies on it. Downgrading means reverting to Webpack or using experimental Turbopack.

4. **Async Request APIs.** Next.js 16 makes `cookies()`, `headers()`, `params`, `searchParams` async-only. Our code already uses the async pattern (e.g., `await auth()` in server components). Downgrading would not break this, but it means we'd lose the compile-time enforcement of async access.

5. **Middleware → Proxy.** Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`. Our current `middleware.ts` still works with a deprecation warning. If we downgrade, this becomes a non-issue. If we stay on 16, we should rename to `proxy.ts` in a future cleanup.

**Recommendation: Stay on Next.js 16.** The spec says "14+", which 16 satisfies. Downgrading costs more than it saves. The App Router API surface is stable and backward-compatible. Staying current gives us Turbopack stability, React 19, and long-term maintenance alignment.

**Action items if staying on 16:**
- Remove `--turbopack` from `pnpm dev` script since it is now the default in 16. ✅ Done below.
- Rename `src/middleware.ts` → `src/proxy.ts` when NextAuth v5 supports the `proxy` convention. Currently blocked — NextAuth v5 beta only supports the `middleware` file convention. The deprecation warning is cosmetic and non-breaking.

## 2. NextAuth v5 Beta

**Spec reference:** §9.1 — "NextAuth.js v5 (Credentials)"

**Current version:** `next-auth@5.0.0-beta.31`

**Rationale:**
- NextAuth v5 has never been released as stable; the latest published version is `5.0.0-beta.31` (published 2026-04-15).
- The stable line tops out at `4.24.14`, which uses a different API surface (pages router convention, no `auth()` export, different middleware pattern).
- v5 beta is the only version that supports the App Router `auth()` export pattern used in our middleware and server components.
- The v5 beta API surface we depend on (`handlers`, `signIn`, `signOut`, `auth`, Credentials provider) has been stable since beta.25+.

**Risk:** Medium. A breaking change in a future beta could require auth code updates. Mitigated by pinning the exact version in `package.json` rather than using a range.

**Mitigation:** Pin `next-auth` to `5.0.0-beta.31` explicitly. Do not use `^5.0.0-beta.31`.

## 3. FTS5 via `prisma db execute` instead of formal Prisma migration

**Spec reference:** §8.6 — "Manage FTS5 setup via raw SQL migrations and triggers"

**Current approach:** FTS5 virtual table and triggers are created via `prisma db execute --file prisma/migrations/fts5_setup.sql` rather than a formal `prisma migrate dev` migration.

**Rationale:**
- Prisma's shadow database validation fails on FTS5 `content=` tables because the shadow DB does not contain the `ResearchArtifact` table at validation time.
- The FTS5 SQL file (`prisma/migrations/fts5_setup.sql`) is preserved as a runnable script with full documentation.
- `prisma db execute` applies the SQL idempotently (all statements use `IF NOT EXISTS`).

**Risk:** Low. The FTS5 setup is not tracked in Prisma's migration history, meaning `prisma migrate reset` will not recreate it. A manual re-run of the FTS5 script is required after a reset.

**Mitigation:** Document the FTS5 setup step in README. Add a post-migration script if needed in P1.

## 4. Decision creation is inline on `/decisions` rather than `/decisions/new`

**Spec reference:** §5.3 D1 — "Create decision"

**Current approach:** The main decision creation form lives inline on the `/decisions` list page. A `/decisions/new` route exists as a redirect to `/decisions`.

**Rationale:**
- Decisions link to research artifacts and scores globally (not scoped to a single asset), so a standalone new-decision page adds no value over an inline form with the full list of available research/scores.
- The redirect preserves the `/decisions/new` URL for any future per-asset creation flow from asset detail pages.

**Risk:** None. The form is functionally identical; only the URL differs.

## 5. `middleware.ts` instead of `proxy.ts`

**Spec reference:** Next.js 16 deprecation warning

**Current approach:** Auth middleware lives in `src/middleware.ts` with the `export { auth }` pattern required by NextAuth v5.

**Rationale:**
- NextAuth v5 beta does not yet support the `proxy.ts` convention. Renaming would break auth.
- Next.js 16 emits a deprecation warning at build time but the middleware still works correctly.

**Risk:** Low. When NextAuth v5 stable ships with proxy support, we can rename the file.

## 6. W6 Manual price entry via nullable columns

**Spec reference:** §5.4 W6 — "Manual price entry"

**Current approach:** `lastKnownPrice` (Float?) and `priceDate` (DateTime?) added as nullable columns to the Asset model. Shown on asset detail and editable in the asset creation form.

**Rationale:**
- These are nullable columns with no default, so existing rows are unaffected.
- No live data feed integration; prices are manually entered.

**Risk:** Low. Nullable columns with no constraints; no migration risk.
