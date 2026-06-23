import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { listStrategies } from "@/lib/strategies";
import {
  computeStrategySummary,
  computeLevelBreakdown,
  computeConversionRate,
  applyFilters,
} from "@/lib/analytics/strategy-review";

const TEST_DB_URL = "file:./test-review.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;
let frameworkId: string;
let scoreId: string;
let assetTicker: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-review@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;

  assetTicker = "AAPL";
  await prisma.asset.create({ data: { ticker: assetTicker, name: "Apple Inc." } });

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
      assetTicker,
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

  // Create recommendations with various levels and conversion states
  // 1. Valuation First - Buy - converted to decision (closed, correct)
  const rec1 = await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      assetTicker,
      recommendation: "Buy",
      reasoning: "Test reasoning 1",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });
  const dec1 = await prisma.decision.create({
    data: {
      title: "[Valuation First] Buy — AAPL",
      direction: "bullish",
      thesis: "Test reasoning 1",
      authorId: userId,
      status: "closed",
      outcome: "correct",
      outcomeDate: new Date(),
      scoreLinks: { create: [{ scoreId }] },
    },
  });
  await prisma.recommendation.update({ where: { id: rec1.id }, data: { convertedDecisionId: dec1.id } });

  // 2. Valuation First - Strong Buy - converted to decision (closed, incorrect)
  const rec2 = await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      assetTicker,
      recommendation: "Strong Buy",
      reasoning: "Test reasoning 2",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });
  const dec2 = await prisma.decision.create({
    data: {
      title: "[Valuation First] Strong Buy — AAPL",
      direction: "bullish",
      thesis: "Test reasoning 2",
      authorId: userId,
      status: "closed",
      outcome: "incorrect",
      outcomeDate: new Date(),
      scoreLinks: { create: [{ scoreId }] },
    },
  });
  await prisma.recommendation.update({ where: { id: rec2.id }, data: { convertedDecisionId: dec2.id } });

  // 3. Valuation First - Watch - converted to decision (open, no outcome)
  const rec3 = await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      assetTicker,
      recommendation: "Watch",
      reasoning: "Test reasoning 3",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });
  const dec3 = await prisma.decision.create({
    data: {
      title: "[Valuation First] Watch — AAPL",
      direction: "neutral",
      thesis: "Test reasoning 3",
      authorId: userId,
      status: "open",
      scoreLinks: { create: [{ scoreId }] },
    },
  });
  await prisma.recommendation.update({ where: { id: rec3.id }, data: { convertedDecisionId: dec3.id } });

  // 4. Valuation First - Avoid - not converted
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      assetTicker,
      recommendation: "Avoid",
      reasoning: "Test reasoning 4",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: "[]",
      researchIds: "[]",
      authorId: userId,
    },
  });

  // 5. Multi-Signal Gate - Buy - converted to decision (closed, partial)
  const rec5 = await prisma.recommendation.create({
    data: {
      strategySlug: "multi-signal-gate",
      strategyName: "Multi-Signal Gate",
      assetTicker,
      recommendation: "Buy",
      reasoning: "Test reasoning 5",
      inputSignals: "[]",
      rulesTriggered: "[]",
      scoreIds: JSON.stringify([scoreId]),
      researchIds: "[]",
      authorId: userId,
    },
  });
  const dec5 = await prisma.decision.create({
    data: {
      title: "[Multi-Signal Gate] Buy — AAPL",
      direction: "bullish",
      thesis: "Test reasoning 5",
      authorId: userId,
      status: "closed",
      outcome: "partial",
      outcomeDate: new Date(),
      scoreLinks: { create: [{ scoreId }] },
    },
  });
  await prisma.recommendation.update({ where: { id: rec5.id }, data: { convertedDecisionId: dec5.id } });

  // 6. Trend Confirmed - not converted
  await prisma.recommendation.create({
    data: {
      strategySlug: "trend-confirmed",
      strategyName: "Trend Confirmed",
      assetTicker,
      recommendation: "Review",
      reasoning: "Test reasoning 6",
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
  await prisma.strategyConfig.deleteMany({});
  await prisma.decisionScoreLink.deleteMany({});
  await prisma.decisionResearchLink.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.score.deleteMany({});
  await prisma.researchArtifact.deleteMany({});
  await prisma.framework.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

// ─── Integration: Summary aggregation from DB ─────────────────

describe("Strategy summary aggregation from DB", () => {
  it("fetches all recommendations and computes summary", async () => {
    const recs = await prisma.recommendation.findMany({
      where: { strategySlug: "valuation-first" },
      select: { id: true, convertedDecisionId: true },
    });

    const decisionIds = recs
      .map((r) => r.convertedDecisionId)
      .filter((id): id is string => id != null);
    const decisions = await prisma.decision.findMany({
      where: { id: { in: decisionIds } },
      select: { id: true, status: true, outcome: true },
    });

    const summary = computeStrategySummary(
      "valuation-first",
      "Valuation First",
      true,
      recs,
      decisions
    );

    expect(summary.totalRecommendations).toBe(4);
    expect(summary.convertedCount).toBe(3);
    expect(summary.conversionRate).toBeCloseTo(0.75, 2);
    expect(summary.linkedDecisionsCount).toBe(3);
    expect(summary.closedDecisionsCount).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.incorrectCount).toBe(1);
    expect(summary.partialCount).toBe(0);
  });

  it("computes summary for multi-signal-gate", async () => {
    const recs = await prisma.recommendation.findMany({
      where: { strategySlug: "multi-signal-gate" },
      select: { id: true, convertedDecisionId: true },
    });

    const decisionIds = recs
      .map((r) => r.convertedDecisionId)
      .filter((id): id is string => id != null);
    const decisions = await prisma.decision.findMany({
      where: { id: { in: decisionIds } },
      select: { id: true, status: true, outcome: true },
    });

    const summary = computeStrategySummary(
      "multi-signal-gate",
      "Multi-Signal Gate",
      true,
      recs,
      decisions
    );

    expect(summary.totalRecommendations).toBe(1);
    expect(summary.convertedCount).toBe(1);
    expect(summary.conversionRate).toBe(1);
    expect(summary.closedDecisionsCount).toBe(1);
    expect(summary.partialCount).toBe(1);
    expect(summary.correctCount).toBe(0);
    expect(summary.incorrectCount).toBe(0);
  });

  it("computes summary for trend-confirmed with no conversions", async () => {
    const recs = await prisma.recommendation.findMany({
      where: { strategySlug: "trend-confirmed" },
      select: { id: true, convertedDecisionId: true },
    });

    const summary = computeStrategySummary(
      "trend-confirmed",
      "Trend Confirmed",
      true,
      recs,
      []
    );

    expect(summary.totalRecommendations).toBe(1);
    expect(summary.convertedCount).toBe(0);
    expect(summary.conversionRate).toBe(0);
    expect(summary.closedDecisionsCount).toBe(0);
  });
});

// ─── Integration: Level breakdown from DB ─────────────────────

describe("Level breakdown from DB", () => {
  it("computes level breakdown across all recommendations", async () => {
    const recs = await prisma.recommendation.findMany({
      select: { recommendation: true, convertedDecisionId: true },
    });

    const decisionIds = recs
      .map((r) => r.convertedDecisionId)
      .filter((id): id is string => id != null);
    const decisions = await prisma.decision.findMany({
      where: { id: { in: decisionIds } },
      select: { id: true, status: true, outcome: true },
    });
    const decisionMap = new Map(decisions.map((d) => [d.id, d]));

    const breakdowns = computeLevelBreakdown(
      recs.map((r) => ({
        recommendation: r.recommendation,
        convertedDecisionId: r.convertedDecisionId,
      })),
      decisionMap
    );

    const buy = breakdowns.find((b) => b.level === "Buy");
    expect(buy!.total).toBe(2); // rec1 + rec5
    expect(buy!.converted).toBe(2);
    expect(buy!.correct).toBe(1);
    expect(buy!.partial).toBe(1);

    const strongBuy = breakdowns.find((b) => b.level === "Strong Buy");
    expect(strongBuy!.total).toBe(1);
    expect(strongBuy!.converted).toBe(1);
    expect(strongBuy!.incorrect).toBe(1);

    const watch = breakdowns.find((b) => b.level === "Watch");
    expect(watch!.total).toBe(1);
    expect(watch!.converted).toBe(1);
    expect(watch!.closed).toBe(0); // open decision

    const avoid = breakdowns.find((b) => b.level === "Avoid");
    expect(avoid!.total).toBe(1);
    expect(avoid!.converted).toBe(0);

    const review = breakdowns.find((b) => b.level === "Review");
    expect(review!.total).toBe(1);
    expect(review!.converted).toBe(0);
  });
});

// ─── Integration: Conversion rate calculations ─────────────────

describe("Conversion rate calculations", () => {
  it("conversion rate = converted / total across all strategies", async () => {
    const allRecs = await prisma.recommendation.findMany();
    const total = allRecs.length;
    const converted = allRecs.filter((r) => r.convertedDecisionId != null).length;
    const rate = computeConversionRate(total, converted);

    expect(total).toBe(6);
    expect(converted).toBe(4);
    expect(rate).toBeCloseTo(0.6667, 3);
  });
});

// ─── Integration: Null / missing edge cases ───────────────────

describe("Null and missing edge cases", () => {
  it("recommendation with no converted decision has null fields", async () => {
    const unconverted = await prisma.recommendation.findFirst({
      where: { convertedDecisionId: null },
    });
    expect(unconverted).not.toBeNull();
    expect(unconverted!.convertedDecisionId).toBeNull();
  });

  it("converted decision with open status has no outcome", async () => {
    const openRec = await prisma.recommendation.findFirst({
      where: { recommendation: "Watch" },
      include: { asset: true },
    });
    const decision = await prisma.decision.findUnique({
      where: { id: openRec!.convertedDecisionId! },
    });
    expect(decision!.status).toBe("open");
    expect(decision!.outcome).toBeNull();
    expect(decision!.outcomeDate).toBeNull();
  });

  it("strategy with no recommendations produces empty summary", () => {
    const summary = computeStrategySummary("nonexistent", "Nonexistent", true, [], []);
    expect(summary.totalRecommendations).toBe(0);
    expect(summary.conversionRate).toBe(0);
  });

  it("computeLevelBreakdown handles decision missing from map", () => {
    const recs = [
      { recommendation: "Buy", convertedDecisionId: "missing-id" },
    ];
    const breakdowns = computeLevelBreakdown(recs, new Map());
    const buy = breakdowns.find((b) => b.level === "Buy");
    expect(buy!.converted).toBe(1);
    expect(buy!.closed).toBe(0);
    expect(buy!.correct).toBe(0);
  });
});

// ─── Integration: Filter behavior on real data ────────────────

describe("Filter behavior on real data shape", () => {
  it("can filter by strategy slug on review items", async () => {
    const recs = await prisma.recommendation.findMany({
      select: {
        id: true, strategySlug: true, strategyName: true, assetTicker: true,
        recommendation: true, createdAt: true, convertedDecisionId: true,
        asset: { select: { name: true } },
      },
    });

    const decisionIds = recs
      .map((r) => r.convertedDecisionId)
      .filter((id): id is string => id != null);
    const decisions = await prisma.decision.findMany({
      where: { id: { in: decisionIds } },
      select: { id: true, status: true, outcome: true, direction: true },
    });
    const decisionMap = new Map(decisions.map((d) => [d.id, d]));

    const items = recs.map((r) => {
      const dec = r.convertedDecisionId ? decisionMap.get(r.convertedDecisionId) : null;
      return {
        id: r.id,
        strategySlug: r.strategySlug,
        strategyName: r.strategyName,
        assetTicker: r.assetTicker,
        assetName: r.asset.name,
        recommendation: r.recommendation,
        createdAt: r.createdAt,
        converted: r.convertedDecisionId != null,
        decisionId: r.convertedDecisionId,
        decisionStatus: dec?.status ?? null,
        decisionDirection: dec?.direction ?? null,
        decisionOutcome: dec?.outcome ?? null,
      };
    });

    // Filter by valuation-first
    const vfItems = applyFilters(items, { strategySlug: "valuation-first" });
    expect(vfItems.length).toBe(4);

    // Filter by converted only
    const convertedItems = applyFilters(items, { convertedOnly: true });
    expect(convertedItems.length).toBe(4);

    // Filter by outcome=correct
    const correctItems = applyFilters(items, { outcome: "correct" });
    expect(correctItems.length).toBe(1);
    expect(correctItems[0].decisionOutcome).toBe("correct");

    // Filter by level=Buy
    const buyItems = applyFilters(items, { recommendationLevel: "Buy" });
    expect(buyItems.length).toBe(2);
  });
});
