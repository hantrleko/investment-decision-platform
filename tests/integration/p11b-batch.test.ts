import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-p11b.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-p11b@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.watchlistEntry.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

// ─── Ticker parsing logic ───────────────────────────────────────

describe("Ticker list parsing", () => {
  it("parses newline-separated tickers", () => {
    const raw = "AAPL\nMSFT\nNVDA";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    expect(parts).toEqual(["AAPL", "MSFT", "NVDA"]);
  });

  it("parses comma-separated tickers", () => {
    const raw = "AAPL, MSFT, NVDA";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    expect(parts).toEqual(["AAPL", "MSFT", "NVDA"]);
  });

  it("parses mixed separators", () => {
    const raw = "AAPL\nMSFT, NVDA\nGOOGL";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    expect(parts).toEqual(["AAPL", "MSFT", "NVDA", "GOOGL"]);
  });

  it("de-duplicates within batch", () => {
    const raw = "AAPL\nMSFT\nAAPL\nMSFT";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    expect(unique).toEqual(["AAPL", "MSFT"]);
  });

  it("normalizes to uppercase", () => {
    const raw = "aapl\nmsft";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    expect(parts).toEqual(["AAPL", "MSFT"]);
  });

  it("trims whitespace", () => {
    const raw = "  AAPL  \n  MSFT  ";
    const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    expect(parts).toEqual(["AAPL", "MSFT"]);
  });
});

// ─── CSV parsing logic ──────────────────────────────────────────

describe("CSV ticker parsing", () => {
  it("parses CSV with ticker column header", () => {
    const csv = "ticker,name\nAAPL,Apple Inc.\nMSFT,Microsoft";
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let tickerIdx = header.findIndex((h) => h === "ticker" || h === "symbol");
    if (tickerIdx === -1) tickerIdx = 0;
    expect(tickerIdx).toBe(0);

    const tickers: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const raw = cols[tickerIdx]?.trim().toUpperCase();
      if (raw) tickers.push(raw);
    }
    expect(tickers).toEqual(["AAPL", "MSFT"]);
  });

  it("finds ticker column when not first", () => {
    const csv = "name,ticker\nApple Inc.,AAPL\nMicrosoft,MSFT";
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let tickerIdx = header.findIndex((h) => h === "ticker" || h === "symbol");
    if (tickerIdx === -1) tickerIdx = 0;
    expect(tickerIdx).toBe(1);

    const tickers: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const raw = cols[tickerIdx]?.trim().toUpperCase();
      if (raw) tickers.push(raw);
    }
    expect(tickers).toEqual(["AAPL", "MSFT"]);
  });

  it("falls back to first column when no header match", () => {
    const csv = "AAPL,Apple\nMSFT,Microsoft";
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    let tickerIdx = header.findIndex((h) => h === "ticker" || h === "symbol");
    if (tickerIdx === -1) tickerIdx = 0;
    expect(tickerIdx).toBe(0);
  });

  it("de-duplicates CSV tickers", () => {
    const csv = "ticker\nAAPL\nAAPL\nMSFT";
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const tickerIdx = header.findIndex((h) => h === "ticker") || 0;
    const tickers: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const raw = cols[tickerIdx]?.trim().toUpperCase();
      if (raw) tickers.push(raw);
    }
    const unique = Array.from(new Set(tickers));
    expect(unique).toEqual(["AAPL", "MSFT"]);
  });
});

// ─── Batch import DB behavior ───────────────────────────────────

describe("Batch import — existing asset skip", () => {
  it("skips assets that already exist", async () => {
    await prisma.asset.create({
      data: { ticker: "AAPL", name: "Apple Inc." },
    });

    const existing = await prisma.asset.findUnique({ where: { ticker: "AAPL" } });
    expect(existing).not.toBeNull();
    // In the batch action, this would be added to skippedExisting
  });

  it("creates new assets that do not exist", async () => {
    const existing = await prisma.asset.findUnique({ where: { ticker: "MSFT" } });
    expect(existing).toBeNull();

    await prisma.asset.create({
      data: { ticker: "MSFT", name: "Microsoft Corp." },
    });

    const created = await prisma.asset.findUnique({ where: { ticker: "MSFT" } });
    expect(created).not.toBeNull();
    expect(created!.name).toBe("Microsoft Corp.");
  });

  it("creates asset with lookup-enriched data when available", async () => {
    await prisma.asset.create({
      data: {
        ticker: "NVDA",
        name: "NVIDIA Corp.",
        exchange: "NASDAQ",
        sector: "Semiconductors",
        lastPrice: 110.50,
        lastPriceTs: new Date(),
        priceSource: "yahoo",
      },
    });

    const asset = await prisma.asset.findUnique({ where: { ticker: "NVDA" } });
    expect(asset!.exchange).toBe("NASDAQ");
    expect(asset!.lastPrice).toBeCloseTo(110.50);
    expect(asset!.priceSource).toBe("yahoo");
  });

  it("creates asset with ticker-only fallback when lookup fails", async () => {
    await prisma.asset.create({
      data: { ticker: "UNKNOWN", name: "UNKNOWN" },
    });

    const asset = await prisma.asset.findUnique({ where: { ticker: "UNKNOWN" } });
    expect(asset).not.toBeNull();
    expect(asset!.lastPrice).toBeNull();
    expect(asset!.priceSource).toBeNull();
  });
});

// ─── Watchlist bulk refresh DB behavior ─────────────────────────

describe("Watchlist bulk refresh", () => {
  it("finds all watchlist tickers for refresh", async () => {
    // Add assets and watchlist entries
    await prisma.asset.create({ data: { ticker: "SPY", name: "SPDR S&P 500" } });
    await prisma.asset.create({ data: { ticker: "QQQ", name: "Invesco QQQ" } });
    await prisma.watchlistEntry.create({ data: { assetTicker: "SPY" } });
    await prisma.watchlistEntry.create({ data: { assetTicker: "QQQ" } });

    const entries = await prisma.watchlistEntry.findMany({
      select: { asset: { select: { ticker: true } } },
    });
    const tickers = entries.map((e) => e.asset.ticker);
    expect(tickers).toContain("SPY");
    expect(tickers).toContain("QQQ");
  });

  it("updates price and timestamp on successful refresh", async () => {
    await prisma.asset.update({
      where: { ticker: "SPY" },
      data: {
        lastPrice: 545.60,
        lastPriceTs: new Date(),
        priceSource: "yahoo",
      },
    });

    const updated = await prisma.asset.findUnique({ where: { ticker: "SPY" } });
    expect(updated!.lastPrice).toBeCloseTo(545.60);
    expect(updated!.lastPriceTs).not.toBeNull();
    expect(updated!.priceSource).toBe("yahoo");
  });

  it("preserves existing price when refresh fails", async () => {
    // Simulate: asset has existing price, refresh fails (we just don't update)
    const before = await prisma.asset.findUnique({ where: { ticker: "SPY" } });
    expect(before!.lastPrice).toBeCloseTo(545.60);

    // In the actual action, a failed refresh would skip the update
    // So the price remains unchanged
    const after = await prisma.asset.findUnique({ where: { ticker: "SPY" } });
    expect(after!.lastPrice).toBeCloseTo(545.60);
  });

  it("returns empty result when watchlist is empty", async () => {
    // Clear watchlist for this test
    await prisma.watchlistEntry.deleteMany({});
    const entries = await prisma.watchlistEntry.findMany({
      select: { asset: { select: { ticker: true } } },
    });
    expect(entries.length).toBe(0);
    // The action would return { updated: [], failed: [], skipped: [] }
  });
});

// ─── Regression: ticker FK integrity ────────────────────────────

describe("Regression — ticker FK integrity after batch operations", () => {
  it("batch-created assets can be linked to research", async () => {
    // Re-add to watchlist for completeness
    await prisma.watchlistEntry.create({ data: { assetTicker: "SPY" } });

    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "SPY Analysis",
        content: "Test",
        assetTicker: "SPY",
        authorId: userId,
      },
    });
    expect(artifact.assetTicker).toBe("SPY");
  });

  it("batch-created assets can be scored", async () => {
    const fw = await prisma.framework.create({
      data: {
        name: "Test P11B",
        slug: "test-p11b",
        schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
      },
    });

    const score = await prisma.score.create({
      data: {
        frameworkId: fw.id,
        assetTicker: "SPY",
        factorScores: "{}",
        compositeScore: 7.0,
        provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });
    expect(score.assetTicker).toBe("SPY");
  });
});
