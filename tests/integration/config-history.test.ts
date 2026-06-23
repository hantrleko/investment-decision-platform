import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { listStrategies } from "@/lib/strategies";
import {
  applyFilters,
  type ReviewItem,
} from "@/lib/analytics/strategy-review";

const TEST_DB_URL = "file:./test-config-history.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;
let frameworkId: string;
let scoreId: string;
let configHistoryId1: string;
let configHistoryId2: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-history@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;

  await prisma.asset.create({ data: { ticker: "AAPL", name: "Apple Inc." } });

  const fw = await prisma.framework.create({
    data: {
      name: "Valuation",
      slug: "valuation",
      schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
    },
  });
  frameworkId = fw.id;

  const score = await prisma.score.create({
    data: {
      frameworkId,
      assetTicker: "AAPL",
      factorScores: '{"intrinsic_value_discount":{"value":7}}',
      compositeScore: 6.15,
      provenance: '{"source":"manual"}',
    },
  });
  scoreId = score.id;

  // Seed strategy configs
  for (const s of listStrategies()) {
    await prisma.strategyConfig.create({
      data: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        active: true,
        version: s.version,
        config: JSON.stringify(s.defaultConfig),
      },
    });
  }

  // Create config history records
  const hist1 = await prisma.strategyConfigHistory.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 7.5, buyThreshold: 6.0, watchThreshold: 4.5, reviewThreshold: 3.0, researchSupportCount: 2 }),
      note: "Initial default configuration",
    },
  });
  configHistoryId1 = hist1.id;

  const hist2 = await prisma.strategyConfigHistory.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 6.0, buyThreshold: 4.5, watchThreshold: 3.0, reviewThreshold: 2.0, researchSupportCount: 2 }),
      note: "Lowered thresholds for aggressive testing",
      experimentLabel: "exp-2026-06-aggressive",
    },
  });
  configHistoryId2 = hist2.id;

  // Create recommendations linked to different config history records
  // 1. Linked to hist1 (default config) - Buy
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 7.5, buyThreshold: 6.0 }),
      configHistoryId: configHistoryId1,
      assetTicker: "AAPL",
      recommendation: "Buy",
      reasoning: "Test reasoning 1",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });

  // 2. Linked to hist2 (aggressive experiment) - Strong Buy
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 6.0, buyThreshold: 4.5 }),
      configHistoryId: configHistoryId2,
      assetTicker: "AAPL",
      recommendation: "Strong Buy",
      reasoning: "Test reasoning 2",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });

  // 3. No config history link (backward compat) - Watch
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 7.5 }),
      configHistoryId: null,
      assetTicker: "AAPL",
      recommendation: "Watch",
      reasoning: "Legacy recommendation",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: "[]",
      researchIds: "[]",
      authorId: userId,
    },
  });
});

afterAll(async () => {
  await prisma.recommendation.deleteMany({});
  await prisma.strategyConfigHistory.deleteMany({});
  await prisma.strategyConfig.deleteMany({});
  await prisma.score.deleteMany({});
  await prisma.researchArtifact.deleteMany({});
  await prisma.framework.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

// ─── Config History Creation ───────────────────────────────────

describe("Config history creation", () => {
  it("creates a history record with config snapshot", async () => {
    const hist = await prisma.strategyConfigHistory.create({
      data: {
        strategySlug: "trend-confirmed",
        strategyName: "Trend Confirmed",
        configSnapshot: JSON.stringify({ buyThreshold: 5.0 }),
        note: "Test config change",
      },
    });

    expect(hist.id).toBeDefined();
    expect(hist.strategySlug).toBe("trend-confirmed");
    expect(hist.note).toBe("Test config change");
    expect(hist.experimentLabel).toBeNull();
    const snapshot = JSON.parse(hist.configSnapshot);
    expect(snapshot.buyThreshold).toBe(5.0);
  });

  it("creates a history record with experiment label", async () => {
    const hist = await prisma.strategyConfigHistory.create({
      data: {
        strategySlug: "multi-signal-gate",
        strategyName: "Multi-Signal Gate",
        configSnapshot: JSON.stringify({ minScores: 1 }),
        experimentLabel: "exp-2026-07-loose",
      },
    });

    expect(hist.experimentLabel).toBe("exp-2026-07-loose");
    expect(hist.note).toBeNull();
  });

  it("persists note and experiment label together", async () => {
    const hist = await prisma.strategyConfigHistory.create({
      data: {
        strategySlug: "valuation-first",
        strategyName: "Valuation First",
        configSnapshot: JSON.stringify({ strongBuyThreshold: 5.0 }),
        note: "Aggressive mode for Q3",
        experimentLabel: "exp-2026-Q3",
      },
    });

    const fetched = await prisma.strategyConfigHistory.findUnique({ where: { id: hist.id } });
    expect(fetched!.note).toBe("Aggressive mode for Q3");
    expect(fetched!.experimentLabel).toBe("exp-2026-Q3");
  });
});

// ─── Config History Retrieval ──────────────────────────────────

describe("Config history retrieval", () => {
  it("fetches history records ordered by date desc", async () => {
    const histories = await prisma.strategyConfigHistory.findMany({
      where: { strategySlug: "valuation-first" },
      orderBy: { createdAt: "desc" },
    });

    expect(histories.length).toBeGreaterThanOrEqual(2);
    // Verify ordering is descending by createdAt
    for (let i = 1; i < histories.length; i++) {
      expect(histories[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(histories[i].createdAt.getTime());
    }
    // hist1 and hist2 should both be present
    const ids = histories.map((h) => h.id);
    expect(ids).toContain(configHistoryId1);
    expect(ids).toContain(configHistoryId2);
  });

  it("history records contain valid JSON config snapshots", async () => {
    const histories = await prisma.strategyConfigHistory.findMany({
      where: { strategySlug: "valuation-first" },
    });

    for (const h of histories) {
      const parsed = JSON.parse(h.configSnapshot);
      expect(typeof parsed).toBe("object");
    }
  });
});

// ─── Recommendation Traceability ───────────────────────────────

describe("Recommendation traceability to config history", () => {
  it("recommendation stores configHistoryId", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: configHistoryId1 },
    });
    expect(rec).not.toBeNull();
    expect(rec!.configHistoryId).toBe(configHistoryId1);
  });

  it("recommendation linked to hist2 has aggressive config", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: configHistoryId2 },
    });
    expect(rec).not.toBeNull();
    const snapshot = JSON.parse(rec!.configSnapshot!);
    expect(snapshot.strongBuyThreshold).toBe(6.0);
  });

  it("recommendation with no config history has null configHistoryId", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: null },
    });
    expect(rec).not.toBeNull();
    expect(rec!.configHistoryId).toBeNull();
  });

  it("can join recommendation to config history", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: configHistoryId2 },
    });
    const hist = await prisma.strategyConfigHistory.findUnique({
      where: { id: rec!.configHistoryId! },
    });
    expect(hist).not.toBeNull();
    expect(hist!.experimentLabel).toBe("exp-2026-06-aggressive");
    expect(hist!.note).toBe("Lowered thresholds for aggressive testing");
  });
});

// ─── Analytics Filtering by Config Context ────────────────────

describe("Analytics filtering by config context", () => {
  function buildReviewItems(): ReviewItem[] {
    return [
      {
        id: "r1", strategySlug: "valuation-first", strategyName: "Valuation First",
        assetTicker: "AAPL", assetName: "Apple Inc.", recommendation: "Buy",
        createdAt: new Date(), converted: false, decisionId: null,
        decisionStatus: null, decisionDirection: null, decisionOutcome: null,
        configHistoryId: configHistoryId1, experimentLabel: null,
      },
      {
        id: "r2", strategySlug: "valuation-first", strategyName: "Valuation First",
        assetTicker: "AAPL", assetName: "Apple Inc.", recommendation: "Strong Buy",
        createdAt: new Date(), converted: false, decisionId: null,
        decisionStatus: null, decisionDirection: null, decisionOutcome: null,
        configHistoryId: configHistoryId2, experimentLabel: "exp-2026-06-aggressive",
      },
      {
        id: "r3", strategySlug: "valuation-first", strategyName: "Valuation First",
        assetTicker: "AAPL", assetName: "Apple Inc.", recommendation: "Watch",
        createdAt: new Date(), converted: false, decisionId: null,
        decisionStatus: null, decisionDirection: null, decisionOutcome: null,
        configHistoryId: null, experimentLabel: null,
      },
    ];
  }

  it("filters by experiment label", () => {
    const items = buildReviewItems();
    const filtered = applyFilters(items, { experimentLabel: "exp-2026-06-aggressive" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r2");
  });

  it("filters by config history id", () => {
    const items = buildReviewItems();
    const filtered = applyFilters(items, { configHistoryId: configHistoryId1 });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("filtering by experiment separates results under different configs", () => {
    const items = buildReviewItems();
    const aggressive = applyFilters(items, { experimentLabel: "exp-2026-06-aggressive" });
    const default_ = applyFilters(items, { configHistoryId: configHistoryId1 });
    expect(aggressive[0].recommendation).toBe("Strong Buy");
    expect(default_[0].recommendation).toBe("Buy");
  });
});

// ─── Backward Compatibility ───────────────────────────────────

describe("Backward compatibility", () => {
  it("recommendation without configHistoryId still retrieves correctly", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: null },
    });
    expect(rec).not.toBeNull();
    expect(rec!.strategySlug).toBe("valuation-first");
    expect(rec!.recommendation).toBe("Watch");
  });

  it("recommendation with configHistoryId but no experiment label works", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { configHistoryId: configHistoryId1 },
    });
    const hist = await prisma.strategyConfigHistory.findUnique({
      where: { id: rec!.configHistoryId! },
    });
    expect(hist!.experimentLabel).toBeNull();
    expect(hist!.note).toBe("Initial default configuration");
  });

  it("all 3 recommendations are retrievable regardless of history linkage", async () => {
    const allRecs = await prisma.recommendation.findMany({
      where: { strategySlug: "valuation-first" },
    });
    expect(allRecs.length).toBe(3);
    const withHistory = allRecs.filter((r) => r.configHistoryId != null);
    const withoutHistory = allRecs.filter((r) => r.configHistoryId == null);
    expect(withHistory.length).toBe(2);
    expect(withoutHistory.length).toBe(1);
  });
});
