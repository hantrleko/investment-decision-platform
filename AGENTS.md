# AGENTS.md

## Project Overview

**Project:** Eugene Finance – Investment Decision Platform (MVP)  
**Status:** P0 implementation-ready, single-user, local-first MVP  
**Primary goal:** Help a research-driven investor make better discretionary investment decisions by centralizing research artifacts, framework-based scoring, decision journaling, and lightweight asset navigation in one system.

This repository follows a **research-first** product philosophy. The **Research Workspace is the canonical source of truth**. All other modules must originate from and link back to research artifacts. No module should become a parallel source of truth or duplicate core research content.[file:145]

## Product Philosophy

### Core principles
- Research comes first; dashboard aesthetics come second.[file:145]
- The app is a **decision-support platform**, not a trading platform.[file:145]
- Every score, suggestion, and decision should be explainable and traceable to evidence.[file:145]
- Provenance is mandatory for all framework outputs and important mutations.[file:145]
- P0 is intentionally narrow: optimize for speed, clarity, auditability, and solo-founder maintainability.[file:145]

### Canonical flow
- Research artifact → framework scoring → decision journal → later outcome review.[file:145]
- Asset pages, watchlists, CSV tools, and scores are supporting surfaces around this flow, not independent centers of gravity.[file:145]

## P0 Scope Guardrails

### In scope
- Single-user authenticated workspace.[file:145]
- Research Workspace with rich-text content, tags, asset links, attachments, search, and CRUD.[file:145]
- Framework Switching and Scoring with dynamic schema-driven forms, provenance, manual override, and side-by-side comparison.[file:145]
- Decision Journal with links to research and scores, plus manual outcome tracking.[file:145]
- Asset list and watchlist as lightweight navigation and context surfaces.[file:145]
- CSV import/export for assets and scores, plus exports for decisions and assets.[file:145]
- Local-first deployment, SQLite database, local filesystem storage.[file:145]

### Explicitly out of scope for P0
- Auto trading or order execution.[file:145]
- Broker integrations.[file:145]
- Social features, collaboration, chat, or community.[file:145]
- Dashboard-centric home experience.[file:145]
- Live market data as a core dependency.[file:145]
- Portfolio rollups, P&L analytics, and advanced portfolio dashboards.[file:145]
- Multi-user auth, permissions, or cloud-first infra.[file:145]
- S3/R2 storage and PostgreSQL for P0.[file:145]
- Real-time notifications and alerting systems.[file:145]

If a requested change touches any of the out-of-scope items above, do not implement it directly. Instead, flag it as **P1** and keep P0 unchanged.[file:145]

## Technical Direction

### Required stack
- TypeScript across the full stack.[file:145]
- Next.js 14 App Router with React Server Components.[file:145]
- Prisma ORM.[file:145]
- SQLite via `better-sqlite3`.[file:145]
- NextAuth.js v5 with Credentials provider.[file:145]
- TipTap for rich-text editing.[file:145]
- shadcn/ui + Radix + Tailwind CSS.[file:145]
- React Hook Form + Zod for forms and validation.[file:145]
- PapaParse for CSV processing.[file:145]
- Vitest + Playwright for testing.[file:145]

### Architectural rules
- Maintain a **full-stack monolith** for P0. No microservices, no extra backend layer, no unnecessary RPC abstraction.[file:145]
- Use **Server Actions** for mutations whenever possible.[file:145]
- Use **Route Handlers** only where appropriate, especially for file upload and CSV import/export.[file:145]
- Keep domain logic in plain TypeScript under `lib/` or equivalent shared domain modules, not embedded inside UI components.[file:145]
- Keep storage behind an `IStorageProvider` interface so local filesystem can later be swapped for S3/R2 without touching domain logic.[file:145]
- Preserve the migration path: SQLite → PostgreSQL, local filesystem → object storage, localhost → cloud deployment.[file:145]

## Data and Domain Rules

### Research Workspace
- Research artifacts are the canonical record of analysis.[file:145]
- A research artifact may link to an asset via `assetTicker`.[file:145]
- Research artifacts may have attachments, tags, linked scores, and linked decisions.[file:145]
- Do not create duplicate “analysis” or “thesis” stores elsewhere if the same content belongs in research artifacts.[file:145]

### Frameworks and scoring
- Framework definitions are schema-driven and stored in the database.[file:145]
- P0 ships with three seed frameworks only: `valuation`, `macro`, and `trend`.[file:145]
- Multi-factor composition is P1, not P0.[file:145]
- The scoring form must render dynamically from `Framework.schemaDefinition`.[file:145]
- Composite score computation is authoritative on the server; optional client preview may use the same shared compute logic.[file:145]
- Multiple scores per framework per asset are allowed; the most recent one is treated as current, and history must remain intact.[file:145]
- Every score must include provenance JSON with source type and timestamp; provenance is immutable after creation except via explicit migration or admin repair tooling.[file:145]
- Manual override must set `manualOverride = true` and preserve the reason.[file:145]

### Decisions
- Decisions are journal entries, not orders.[file:145]
- Every decision should support links to one or more research artifacts and one or more scores.[file:145]
- Outcomes are entered manually in P0.[file:145]
- Decision status changes from `open` to `closed` when an outcome is recorded.[file:145]

### Assets and watchlist
- Assets are lightweight entities supporting research and score linkage.[file:145]
- Watchlist is contextual navigation, not a market terminal.[file:145]
- Do not overbuild asset screens into rich live-data dashboards in P0.[file:145]

## UX Rules

### UX priorities
- Optimize for focused, research-heavy workflows over flashy interfaces.[file:145]
- Use a professional, finance-appropriate, high-contrast UI.[file:145]
- Avoid crypto-bro, retail trading, gamified, or social-feed aesthetics.
- Prioritize keyboard-friendly workflows and low-friction navigation for power users.[file:145]
- Keep the top-level navigation aligned with the spec IA: Research, Assets, Scores, Decisions, Settings.[file:145]

### Page importance
1. Research Workspace is the primary entry point.[file:145]
2. Asset detail pages are hubs for linked Research, Scores, and Decisions.[file:145]
3. Scores are shown with provenance and comparison context.[file:145]
4. Decision pages emphasize rationale and later outcome review.[file:145]

Do not introduce a dashboard-first landing page in P0.[file:145]

## Storage Rules

### Database
- Use SQLite for P0.[file:145]
- Prisma schema is the contract for persistence.[file:145]
- Keep migrations explicit and reviewable.
- Avoid premature abstractions for multi-tenant data separation in P0.

### Files
- Use local filesystem storage only in P0.[file:145]
- Store files under the local storage root via `LocalStorageProvider`.[file:145]
- Do not write direct `fs` calls throughout the app; go through the storage abstraction.[file:145]
- Enforce attachment size limits from environment variables.[file:145]

### Search
- Use SQLite FTS5 for research artifact search as specified.[file:145]
- Manage FTS5 setup via raw SQL migrations and triggers.[file:145]
- If FTS5 becomes unstable, a temporary fallback to simpler search is acceptable only if it preserves the P0 acceptance criteria as closely as possible.[file:145]

## Authentication Rules

- P0 is single-user only.[file:145]
- Use NextAuth Credentials provider with seeded admin user.[file:145]
- Credentials come from environment variables, not hardcoded values.[file:145]
- No self-registration, password reset, invite flow, or role system in P0.[file:145]
- Protect all routes except the login page.[file:145]

## Coding Rules

### General coding style
- Prefer simple, readable, explicit code over clever abstractions.
- Keep modules small and named by domain intent.
- Avoid introducing new libraries unless the current stack clearly cannot solve the problem.
- Prefer server-first patterns over heavy client state.[file:145]
- Use Zod validation for all external inputs, especially forms, server actions, and CSV rows.[file:145]
- Reuse shared domain logic rather than duplicating business logic in client and server code.

### Data integrity
- Never silently drop provenance, links, or timestamps.
- Never overwrite linked historical records in a way that breaks decision traceability.
- When deleting entities, respect spec-defined warnings and cascade behavior.[file:145]
- Preserve referential integrity between assets, research artifacts, scores, and decisions.[file:145]

### CSV handling
- P0 CSV imports are limited in scope; do not add mapping UIs or “smart cleanup” flows.[file:145]
- Validate headers and rows with Zod.[file:145]
- Report row-level errors clearly.[file:145]
- Use upsert behavior where specified.[file:145]
- Keep import synchronous for P0 unless the spec is explicitly changed.[file:145]

## Testing and Validation

### Required test coverage
Every substantive feature change should be accompanied by tests at the appropriate level:
- Unit tests for domain logic like score computation, schema parsing, provenance, CSV serialization, storage helpers.[file:145]
- Integration tests for CRUD flows, score creation, decision linking, watchlist behavior, import/export.[file:145]
- E2E tests for the four critical user flows identified in the spec.[file:145]

### Must-protect flows
- Research → Score → Decision.[file:145]
- CSV import → Asset creation → Research initiation.[file:145]
- Framework switch → Re-score → Side-by-side comparison.[file:145]
- Decision outcome logging.[file:145]

### Definition of done
A task is not done unless:
- It satisfies the relevant acceptance criteria from the spec.[file:145]
- It includes validation for errors and edge cases where applicable.[file:145]
- It preserves P0 scope boundaries.[file:145]
- It does not regress canonical linking across Research, Scores, Decisions, and Assets.[file:145]

## Execution Priorities

When deciding what to build first, follow this order unless explicitly overridden:
1. Project setup, auth, schema, and storage abstraction.[file:145]
2. Research Workspace CRUD and search.[file:145]
3. Attachments and asset linking.[file:145]
4. Framework scoring and provenance.[file:145]
5. Decision Journal and outcome recording.[file:145]
6. Watchlist and asset navigation.[file:145]
7. CSV import/export.[file:145]
8. Testing, polish, and bug fixes.[file:145]

## Open Questions Handling

Some decisions remain open in the spec. Default to the recommended answer unless explicitly changed:
- Store research content as TipTap JSON in P0.[file:145]
- Allow multiple scores per framework per asset; newest is current.[file:145]
- Compute composite score on the server, with optional client preview using shared logic.[file:145]
- Keep CSV import synchronous for P0.[file:145]
- Seed auth credentials from environment variables.[file:145]
- Do not version framework schemas in P0; warn when editing active frameworks.[file:145]

If a change conflicts with one of these recommendations, raise it clearly before implementation.

## What to Avoid

- Do not turn P0 into a generic SaaS starter app.
- Do not center the product around dashboards, charts, or live feeds at the expense of research workflows.
- Do not add cloud-only dependencies for convenience.
- Do not optimize for hypothetical scale before validating the product.
- Do not introduce multi-user complexity early.
- Do not implement P1 features under the guise of “small improvements.”
- Do not break the local-first, single-user, zero-ops philosophy of P0.[file:145]

## PR / Change Rules

For every meaningful change:
- Reference the relevant module and acceptance criteria from the specification.[file:145]
- State whether the change is P0-required, P0-optional, or P1-deferred.[file:145]
- Describe any migration, schema, or storage impact.
- Mention any new tests added or updated.
- Flag any unresolved trade-off explicitly.

## Preferred Working Pattern for Agents

When implementing a feature:
1. Identify the relevant spec section and acceptance criteria.[file:145]
2. Confirm the feature is in P0 scope.[file:145]
3. Implement the smallest viable slice that satisfies the criteria.
4. Add or update tests.
5. Verify navigation and linking back to Research Workspace where applicable.
6. Avoid opportunistic refactors unless they are necessary for correctness.

When uncertain, choose the simpler path that keeps the repo maintainable and aligned with the P0 spec.[file:145]
