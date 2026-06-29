#!/bin/bash
set -e

echo "=== Eugene Finance Startup ==="

# Ensure data directory exists (Railway volume mount point)
mkdir -p ./data
mkdir -p ./storage

# Set DATABASE_URL to use the persistent volume if not already set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:./data/dev.db"
fi

echo "Database: $DATABASE_URL"

# Generate Prisma client (already in image, but ensure)
npx prisma generate

# Push schema to database (creates tables if not exists, safe to run repeatedly)
echo "Pushing database schema..."
npx prisma db push --skip-generate

# Check if DB is empty (no User table content)
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM User;" --url "$DATABASE_URL" 2>/dev/null | grep -o '[0-9]+' || echo "0")

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "Database is empty, seeding..."
  npx prisma db seed
  echo "Seed complete."
else
  echo "Database already has data, skipping seed."
fi

# Set up FTS5 (idempotent — uses IF NOT EXISTS)
echo "Setting up FTS5..."
npx prisma db execute --file prisma/migrations/fts5_setup.sql --schema prisma/schema.prisma || echo "FTS5 setup skipped (may not be supported)"

echo "=== Starting Next.js server ==="
exec next start -p ${PORT:-3000} -H ${HOSTNAME:-0.0.0.0}
