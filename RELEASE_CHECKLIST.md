# Release Checklist — Eugene Finance

## Pre-Release Verification

### 1. Database

- [ ] `npx prisma db push --force-reset` completes without errors
- [ ] `pnpm db:seed` creates: 1 user, 3 frameworks, 3 strategy configs, 3+ config history records, 3 demo assets, 3 research artifacts, 5 scores, 2 decisions, 4 recommendations, 1 watchlist entry
- [ ] `npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma` succeeds
- [ ] FTS5 search works (search for "earnings" on /research returns results)

### 2. Tests

- [ ] `pnpm test` passes with 216+ tests, 0 failures
- [ ] No test files skipped or excluded

### 3. Build

- [ ] `pnpm build` compiles successfully
- [ ] All 19+ routes generate without errors
- [ ] No TypeScript type errors

### 4. Core Flow Smoke Test

Perform each step in the browser after `pnpm dev`:

- [ ] **Login** — Navigate to `/auth/login`, enter credentials, redirect to `/research`
- [ ] **Research** — See seeded research artifacts, click one, read content, search works
- [ ] **Assets** — See 3 seeded assets with prices, click AAPL, see hub (research, scores, decisions, recommendations)
- [ ] **Scores** — See 5 seeded scores, click one, see factor breakdown
- [ ] **Decisions** — See 2 seeded decisions (1 closed with outcome), create a new decision
- [ ] **Strategies** — See 3 strategies with Active badges, summary table shows metrics
- [ ] **Run Strategy** — Select a strategy + asset, click Run, redirected to recommendation detail
- [ ] **Recommendation Detail** — See reasoning, signals, rules, config snapshot, config history record
- [ ] **Convert to Decision** — Click Convert, redirected to new decision
- [ ] **Strategy Config** — Click Configure, change a threshold, add note + experiment label, save
- [ ] **Config History** — Verify new history record appears in table
- [ ] **Strategy Review** — See metrics tables, experiment column, use filters
- [ ] **Watchlist** — Add/remove asset from watchlist, refresh prices
- [ ] **Batch Import** — Import assets via paste or CSV

### 5. Edge Cases

- [ ] Empty database (reset without seed) — all pages show helpful empty states
- [ ] Sign out → all protected routes redirect to login
- [ ] Stale JWT after DB reset — server actions return "Session expired" message
- [ ] Inactive strategy — cannot be run, shows Inactive badge
- [ ] Recommendation without config history — detail page still renders

### 6. Documentation

- [ ] README.md is current (modules, setup, demo flow)
- [ ] DEVIATIONS.md is current (version deviations documented)
- [ ] RELEASE_CHECKLIST.md is current (this file)

## Modules Overview

| Module | Status | Key Features |
|---|---|---|
| Research | Complete | Rich-text editor, FTS5 search, file attachments, asset linking |
| Assets | Complete | Auto-lookup, watchlist, batch import, price refresh, manual pricing |
| Scores | Complete | Framework-based scoring, weighted composite, provenance tracking |
| Decisions | Complete | Direction + thesis, linked scores/research, outcome recording |
| Strategies | Complete | 3 built-in strategies, configurable thresholds, config history, experiment tracking |
| Recommendations | Complete | Explainable output, config snapshots, convert to decision |
| Analytics | Complete | Per-strategy metrics, level breakdowns, experiment filtering |

## Intentionally Out of Scope

- Multi-user permissions / team collaboration
- Broker integration or order execution
- Backtesting engine
- Auto-optimization / parameter tuning
- Scheduled strategy runs or alerts
- Portfolio analytics or P&L tracking
- Chart-heavy dashboards
- Mobile-responsive layout optimization
- Production deployment infrastructure (Docker, CI/CD)
- External data feeds beyond Yahoo Finance

## Release Tag Convention

```
v<major>.<minor>.<patch>-<milestone>

Examples:
v0.1.0-p0      — P0 MVP
v0.2.0-p1      — P1 with asset lookup + batch import
v0.3.0-strat   — Strategy Engine v1-v1.3
v0.4.0-r1      — Release Pass R1 (this release)
```

## Pre-Tag Commands

```bash
# Full verification sequence
npx prisma db push --force-reset
pnpm db:seed
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma
pnpm test
pnpm build
pnpm dev  # then run through the smoke test above

# Tag the release
git tag v0.4.0-r1
git push origin v0.4.0-r1
```
