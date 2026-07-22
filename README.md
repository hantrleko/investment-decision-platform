# Eugene Finance — Investment Decision Platform

A research-first investment decision platform for discretionary investors. Centralizes research documents, framework-based scoring, decision journaling, strategy recommendations, and analytics in one system.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+

### Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env — set ADMIN_EMAIL, ADMIN_PASSWORD, and NEXTAUTH_SECRET

# Reset/create database schema
npx prisma db push --force-reset

# Seed the database (admin user + 3 frameworks + 3 strategies + demo data)
pnpm db:seed

# Set up full-text search (FTS5)
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

### Default Credentials

Configured via `.env`:

- **Email:** `ADMIN_EMAIL` (default: `admin@eugene.finance`)
- **Password:** `ADMIN_PASSWORD` (default: `changeme`)

### Reset Database

If you need a clean slate (after schema changes or to reseed demo data):

```bash
npx prisma db push --force-reset
pnpm db:seed
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma
```

### Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests (250+ tests including autoscore unit suite) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |
| `pnpm db:seed` | Seed database (frameworks + strategies + demo data) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Regenerate Prisma client |

## Architecture

- **Framework:** Next.js 16 App Router (full-stack monolith, RSC + Server Actions)
- **Database:** SQLite via Prisma (12 models)
- **Auth:** NextAuth v5 beta (Credentials provider, single-user)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Editor:** TipTap v3 rich-text
- **Storage:** Local filesystem behind `IStorageProvider` abstraction
- **Market Data:** Yahoo Finance v8 chart API + quoteSummary fundamentals (crumb auth) for Auto Evaluate
- **Testing:** Vitest (unit + integration, in-memory SQLite per test file)

## App Modules

### Research (`/research`)
Create and manage research artifacts with a rich-text editor. Link research to assets, attach files, search with full-text search (FTS5). Research serves as the evidence base for scores and decisions.

### Assets (`/assets`)
Track assets (equities) with auto-lookup from Yahoo Finance. Watchlist with price refresh, batch import via CSV or paste, manual price entry. Asset detail shows research, scores, decisions, and strategy recommendations in one hub.

### Scores (`/scores`)
Score assets using framework definitions. Each framework (Valuation, Macro, Trend) has weighted factors scored 0-10. Composite scores are auto-calculated. Scores can be linked to research artifacts for provenance.

### Auto Evaluate (Phase 1 + 2)
One-click machine scoring from live Yahoo Finance data:

1. Open an asset detail page (or New Score) and click **Auto Evaluate**
2. System fetches fundamentals (quoteSummary + crumb auth) and 1y OHLCV bars
3. Maps **Valuation** (sector-relative grading), **Trend** (Minervini + RSI/RS/volume), and **Macro** (lightweight proxies)
4. Writes scores with provenance `source: "auto"`, creates a markdown research report, and runs the Multi-Signal Gate strategy
5. Manual **Score with Framework** remains available for overrides

Core library: `src/lib/autoscore/` · Server action: `src/actions/autoscore.ts`

### Decisions (`/decisions`)
Journal investment decisions with direction (bullish/bearish/neutral), thesis, linked research and scores. Record outcomes (correct/incorrect/partial) after the fact. Decisions are the ground truth for strategy analytics.

### Strategies (`/strategies`)
Run built-in strategies that evaluate framework scores to produce explainable recommendations (Strong Buy through Reject). Three strategies:
- **Valuation First** — prioritizes the Valuation framework score
- **Trend Confirmed** — uses Trend framework with momentum/price structure confirmation
- **Multi-Signal Gate** — requires 2+ scores, combines all frameworks with gated thresholds

Each strategy has configurable thresholds stored in the DB. Config changes are tracked via config history with optional notes and experiment labels. Recommendations store a config snapshot for reproducibility.

### Strategy Review (`/strategies/review`)
Analytics dashboard showing per-strategy metrics (recommendation count, conversion rate, outcome distribution). Filter by strategy, asset, recommendation level, converted status, outcome, and experiment label.

## Suggested Demo Flow

After seeding (which creates demo data for AAPL, NVDA, and MSFT):

1. **Research** — Go to `/research`. You'll see 3 pre-seeded research artifacts (AAPL earnings, NVDA data center, MSFT cloud). Click one to read the full content.

2. **Assets** — Go to `/assets`. You'll see AAPL, NVDA, MSFT with prices. Click AAPL to see its research, scores, decisions, and recommendations in one hub.

3. **Scores** — Go to `/scores`. You'll see 5 pre-seeded scores across Valuation and Trend frameworks. Click one to see factor-level breakdown.

4. **Decisions** — Go to `/decisions`. You'll see 2 decisions: AAPL (closed, correct outcome) and NVDA (open). The AAPL decision shows the outcome note.

5. **Strategies** — Go to `/strategies`. You'll see 3 strategies with Active badges and a summary table. The strategy runner shows recent recommendations. Try running "Multi-Signal Gate" on NVDA (which has 2 scores).

6. **Strategy Config** — Click "Configure" on any strategy. Adjust thresholds, add a note like "Testing lower thresholds", add an experiment label like "exp-test-1", and save. The config history table shows all past changes.

7. **Strategy Review** — Click "Review & Analytics". See per-strategy metrics, recommendation level analytics, and the recommendation list with experiment labels. Use filters to isolate results.

8. **Recommendation Detail** — Click any recommendation. See the reasoning, input signals, rules triggered, linked scores/research, config snapshot, and config history record. If converted to a decision, see the decision status and outcome.

9. **Convert to Decision** — Find an unconverted recommendation and click "Convert to Decision". This creates a decision with the recommendation's direction, thesis, and linked scores/research.

## Data Model

12 Prisma models:

| Model | Purpose |
|---|---|
| User | Single-user auth (NextAuth Credentials) |
| Asset | Tracked equities (ticker is PK) |
| Framework | Scoring framework definitions (JSON schema) |
| ResearchArtifact | Research documents with rich-text content |
| DocumentAttachment | File attachments on research |
| Score | Framework scores on assets (factor-level + composite) |
| Decision | Investment decisions with direction, thesis, outcome |
| DecisionResearchLink | M2M: Decision ↔ ResearchArtifact |
| DecisionScoreLink | M2M: Decision ↔ Score |
| WatchlistEntry | Asset watchlist |
| StrategyConfig | DB-backed strategy configuration (active, thresholds) |
| StrategyConfigHistory | Audit trail of config changes (note, experiment label) |
| Recommendation | Strategy output with reasoning, signals, config snapshot |

## Testing

```bash
# Run all 216 tests
pnpm test

# Run a specific test file
pnpm test tests/unit/strategies/strategy-engine.test.ts

# Run with coverage
pnpm test -- --coverage
```

Test structure:
- `tests/unit/` — Pure logic tests (scoring, strategies, analytics, search, storage, market data)
- `tests/integration/` — DB-backed tests with isolated SQLite per file (research CRUD, asset watchlist, scoring flow, decision flow, strategy recommendation, strategy review, config history)

## Production Build

```bash
pnpm build
pnpm start
```

## Railway Deployment

This app includes a `Dockerfile` and `railway.json` configured for Railway deployment with persistent SQLite storage.

### Steps

1. Go to [railway.app](https://railway.app) and create a new project
2. Deploy from GitHub repo → select `hantrleko/investment-decision-platform`
3. Railway will detect the `Dockerfile` and build automatically
4. Set the following environment variables in Railway:

| Variable | Value | Notes |
|---|---|---|
| `ADMIN_EMAIL` | your email | Login email |
| `ADMIN_PASSWORD` | your password | Login password |
| `NEXTAUTH_SECRET` | random string | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.up.railway.app` | Your Railway domain |
| `DATABASE_URL` | `file:./data/dev.db` | Uses persistent volume |
| `STORAGE_PATH` | `./storage` | Uses persistent volume |

5. Railway will automatically mount persistent volumes at `/app/data` (database) and `/app/storage` (attachments)
6. On first deploy, the start script will automatically:
   - Push the database schema (`prisma db push`)
   - Seed initial data (user, frameworks, strategies, demo data)
   - Set up FTS5 full-text search
7. Subsequent deploys skip seeding if data already exists

### Railway CLI (optional)

```bash
npm install -g @railway/cli
railway login
railway link    # link to your Railway project
railway up      # deploy
```

## Project Files

- `DEVIATIONS.md` — Version deviations from spec with rationale
- `RELEASE_CHECKLIST.md` — Pre-release verification checklist
- `eugene-finance-mvp-spec.md` — Original MVP specification
- `prisma/migrations/fts5_setup.sql` — FTS5 virtual table + triggers (run manually after reset)

## Known Limitations

- Single-user only (no multi-user permissions)
- SQLite (not suitable for concurrent production use)
- Yahoo Finance API is unofficial and may rate-limit
- No broker integration or order execution
- No backtesting or auto-optimization
- No scheduled strategy runs or alerts
