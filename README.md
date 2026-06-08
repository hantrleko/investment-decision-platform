# Eugene Finance – Investment Decision Platform

A research-first investment decision platform for discretionary investors. Centralizes research documents, framework-based scoring, decision journaling, and lightweight asset navigation in one system.

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

# Run database migration
pnpm db:migrate

# Seed the database (admin user + 3 frameworks)
pnpm db:seed

# Set up full-text search (FTS5)
# This must be run after the initial migration. It is not tracked by Prisma migrate.
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

### Verifying FTS5

The FTS5 virtual table (`research_search`) is required for research artifact search (§8.6). It is set up outside Prisma's migration system because Prisma's shadow database validation cannot handle FTS5 `content=` tables.

To verify it is working:

```bash
# Open Prisma Studio
pnpm db:studio

# Or check via SQLite CLI:
npx prisma db execute --stdin <<< "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'research_%';"
# Expected output: research_ai, research_ad, research_au
```

If you ever run `prisma migrate reset`, you must re-apply the FTS5 setup:

```bash
pnpm db:migrate
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma
pnpm db:seed
```

### Default Credentials

Configured via `.env`:

- **Email:** `ADMIN_EMAIL` (default: `admin@eugene.finance`)
- **Password:** `ADMIN_PASSWORD` (default: `changeme`)

### Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |

## Architecture

- **Framework:** Next.js 16 App Router (full-stack monolith)
- **Database:** SQLite via Prisma
- **Auth:** NextAuth v5 (Credentials, single-user)
- **UI:** shadcn/ui + Tailwind CSS
- **Storage:** Local filesystem behind `IStorageProvider` abstraction

## Project Status

P0 MVP — Mission 1 complete (project setup, auth, schema, storage).
