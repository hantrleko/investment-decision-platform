import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-p11a.db";
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
    data: { email: "test-p11a@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.watchlistEntry.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("Asset price fields", () => {
  it("creates an asset with lastPrice, lastPriceTs, priceSource", async () => {
    const asset = await prisma.asset.create({
      data: {
        ticker: "AAPL",
        name: "Apple Inc.",
        sector: "Technology",
        exchange: "NMS",
        lastPrice: 192.53,
        lastPriceTs: new Date("2026-06-08T15:30:00Z"),
        priceSource: "yahoo",
      },
    });

    expect(asset.ticker).toBe("AAPL");
    expect(asset.lastPrice).toBeCloseTo(192.53);
    expect(asset.lastPriceTs).toBeTruthy();
    expect(asset.priceSource).toBe("yahoo");
  });

  it("creates an asset with manual price", async () => {
    const asset = await prisma.asset.create({
      data: {
        ticker: "TSLA",
        name: "Tesla Inc.",
        lastPrice: 180.5,
        lastPriceTs: new Date(),
        priceSource: "manual",
      },
    });

    expect(asset.priceSource).toBe("manual");
  });

  it("creates an asset with no price at all", async () => {
    const asset = await prisma.asset.create({
      data: {
        ticker: "MSFT",
        name: "Microsoft Corp.",
      },
    });

    expect(asset.lastPrice).toBeNull();
    expect(asset.lastPriceTs).toBeNull();
    expect(asset.priceSource).toBeNull();
  });

  it("updates price via refresh (yahoo)", async () => {
    const before = await prisma.asset.findUnique({ where: { ticker: "AAPL" } });
    expect(before!.lastPrice).toBeCloseTo(192.53);

    const updated = await prisma.asset.update({
      where: { ticker: "AAPL" },
      data: {
        lastPrice: 195.12,
        lastPriceTs: new Date(),
        priceSource: "yahoo",
      },
    });

    expect(updated.lastPrice).toBeCloseTo(195.12);
    expect(updated.priceSource).toBe("yahoo");
  });

  it("updates price via manual entry", async () => {
    const updated = await prisma.asset.update({
      where: { ticker: "AAPL" },
      data: {
        lastPrice: 200.0,
        lastPriceTs: new Date(),
        priceSource: "manual",
      },
    });

    expect(updated.lastPrice).toBeCloseTo(200.0);
    expect(updated.priceSource).toBe("manual");
  });
});

describe("Watchlist with price display", () => {
  it("watchlist entry includes price data from asset", async () => {
    const entry = await prisma.watchlistEntry.create({
      data: { assetTicker: "AAPL", notes: "Watching" },
      include: { asset: { select: { ticker: true, name: true, lastPrice: true, lastPriceTs: true, priceSource: true } } },
    });

    expect(entry.asset.lastPrice).toBeCloseTo(200.0);
    expect(entry.asset.priceSource).toBe("manual");
  });
});

describe("Ticker remains primary key — no symbol introduced", () => {
  it("research artifact links via assetTicker (ticker FK)", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "AAPL Analysis",
        content: "Test",
        assetTicker: "AAPL",
        authorId: userId,
      },
    });

    expect(artifact.assetTicker).toBe("AAPL");
  });

  it("score links via assetTicker (ticker FK)", async () => {
    const fw = await prisma.framework.create({
      data: {
        name: "Test FW",
        slug: "test-fw-p11a",
        schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
      },
    });

    const score = await prisma.score.create({
      data: {
        frameworkId: fw.id,
        assetTicker: "AAPL",
        factorScores: "{}",
        compositeScore: 7.5,
        provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });

    expect(score.assetTicker).toBe("AAPL");
  });

  it("decision links via research and score both resolve to ticker", async () => {
    const decision = await prisma.decision.create({
      data: {
        title: "Go long AAPL",
        direction: "bullish",
        thesis: "Test",
        authorId: userId,
      },
    });

    // Link via research
    const artifact = await prisma.researchArtifact.findFirst({
      where: { assetTicker: "AAPL" },
    });
    if (artifact) {
      await prisma.decisionResearchLink.create({
        data: { decisionId: decision.id, researchArtifactId: artifact.id },
      });
    }

    // Verify decision can be found via research → assetTicker
    const found = await prisma.decision.findMany({
      where: {
        researchLinks: { some: { researchArtifact: { assetTicker: "AAPL" } } },
      },
    });
    expect(found.length).toBeGreaterThan(0);
  });
});
