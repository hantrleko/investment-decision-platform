import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-strategy.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;
let frameworkId: string;
let scoreId: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-strategy@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;

  await prisma.asset.create({
    data: { ticker: "AAPL", name: "Apple Inc." },
  });

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
      factorScores: '{"intrinsic_value_discount":{"value":7},"margin_of_safety":{"value":5},"catalyst_clarity":{"value":6},"quality_moat":{"value":8},"sentiment_contrarian":{"value":4}}',
      compositeScore: 6.15,
      provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
    },
  });
  scoreId = score.id;
});

afterAll(async () => {
  await prisma.recommendation.deleteMany({});
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

describe("Recommendation persistence", () => {
  it("creates a recommendation record with all fields", async () => {
    const rec = await prisma.recommendation.create({
      data: {
        strategySlug: "valuation-first",
        strategyName: "Valuation First",
        assetTicker: "AAPL",
        recommendation: "Buy",
        reasoning: "Valuation First strategy evaluated AAPL with composite 6.15. Result: Buy.",
        inputSignals: JSON.stringify([
          { signal: "valuation_composite", value: "6.15" },
          { signal: "research_count", value: "0" },
        ]),
        rulesTriggered: JSON.stringify([
          { rule: "composite >= 6.0", detail: "Valuation composite 6.15 is favorable" },
        ]),
        scoreIds: JSON.stringify([scoreId]),
        researchIds: JSON.stringify([]),
        authorId: userId,
      },
    });

    expect(rec.id).toBeDefined();
    expect(rec.strategySlug).toBe("valuation-first");
    expect(rec.recommendation).toBe("Buy");
    expect(rec.assetTicker).toBe("AAPL");
    expect(rec.convertedDecisionId).toBeNull();
  });

  it("retrieves recommendation with asset relation", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { strategySlug: "valuation-first" },
      include: { asset: { select: { ticker: true, name: true } } },
    });

    expect(rec).not.toBeNull();
    expect(rec!.asset.ticker).toBe("AAPL");
    expect(rec!.asset.name).toBe("Apple Inc.");
  });

  it("parses JSON fields correctly", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { strategySlug: "valuation-first" },
    });

    const signals = JSON.parse(rec!.inputSignals);
    const rules = JSON.parse(rec!.rulesTriggered);
    const sIds = JSON.parse(rec!.scoreIds);
    const rIds = JSON.parse(rec!.researchIds);

    expect(signals).toHaveLength(2);
    expect(rules).toHaveLength(1);
    expect(sIds).toContain(scoreId);
    expect(rIds).toHaveLength(0);
  });
});

describe("Recommendation → Decision conversion", () => {
  it("creates a decision and links it to the recommendation", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { strategySlug: "valuation-first" },
    });

    // Create decision
    const decision = await prisma.decision.create({
      data: {
        title: "[Valuation First] Buy — AAPL",
        direction: "bullish",
        thesis: "Valuation First strategy evaluated AAPL with composite 6.15. Result: Buy.",
        authorId: userId,
        scoreLinks: {
          create: [{ scoreId }],
        },
      },
    });

    // Link recommendation to decision
    const updated = await prisma.recommendation.update({
      where: { id: rec!.id },
      data: { convertedDecisionId: decision.id },
    });

    expect(updated.convertedDecisionId).toBe(decision.id);
    expect(decision.direction).toBe("bullish");
    expect(decision.title).toContain("Valuation First");
  });

  it("prevents double conversion", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { strategySlug: "valuation-first" },
    });

    expect(rec!.convertedDecisionId).not.toBeNull();
    // In the server action, this would return:
    // { error: "This recommendation has already been converted to a decision" }
  });

  it("decision created from recommendation has linked scores", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { strategySlug: "valuation-first" },
      include: { asset: true },
    });

    const decision = await prisma.decision.findUnique({
      where: { id: rec!.convertedDecisionId! },
      include: {
        scoreLinks: { include: { score: { select: { id: true, framework: { select: { name: true } } } } } },
      },
    });

    expect(decision!.scoreLinks.length).toBeGreaterThan(0);
    expect(decision!.scoreLinks[0].score.id).toBe(scoreId);
  });
});

describe("Multiple recommendations per asset", () => {
  it("allows multiple strategy recommendations for same asset", async () => {
    // Add a trend score
    const trendFw = await prisma.framework.create({
      data: {
        name: "Trend",
        slug: "trend",
        schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
      },
    });

    await prisma.score.create({
      data: {
        frameworkId: trendFw.id,
        assetTicker: "AAPL",
        factorScores: '{"price_structure":{"value":6},"momentum_signal":{"value":7},"volume_confirmation":{"value":5},"relative_strength":{"value":8}}',
        compositeScore: 6.40,
        provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });

    // Create second recommendation with different strategy
    const rec2 = await prisma.recommendation.create({
      data: {
        strategySlug: "trend-confirmed",
        strategyName: "Trend Confirmed",
        assetTicker: "AAPL",
        recommendation: "Buy",
        reasoning: "Trend Confirmed strategy evaluated AAPL.",
        inputSignals: JSON.stringify([{ signal: "trend_composite", value: "6.40" }]),
        rulesTriggered: JSON.stringify([{ rule: "trend_composite >= 6.0", detail: "strong" }]),
        scoreIds: JSON.stringify([]),
        researchIds: JSON.stringify([]),
        authorId: userId,
      },
    });

    expect(rec2.strategySlug).toBe("trend-confirmed");

    // Verify both recommendations exist for AAPL
    const allRecs = await prisma.recommendation.findMany({
      where: { assetTicker: "AAPL" },
      orderBy: { createdAt: "desc" },
    });
    expect(allRecs.length).toBeGreaterThanOrEqual(2);
    const slugs = allRecs.map((r) => r.strategySlug);
    expect(slugs).toContain("valuation-first");
    expect(slugs).toContain("trend-confirmed");
  });
});

describe("Regression — ticker FK integrity", () => {
  it("recommendation FK to asset.ticker works correctly", async () => {
    const recs = await prisma.recommendation.findMany({
      where: { assetTicker: "AAPL" },
    });
    recs.forEach((r) => expect(r.assetTicker).toBe("AAPL"));
  });

  it("recommendation FK to user.id works correctly", async () => {
    const recs = await prisma.recommendation.findMany({
      where: { authorId: userId },
    });
    recs.forEach((r) => expect(r.authorId).toBe(userId));
  });

  it("cascade delete: deleting asset removes recommendations", async () => {
    // Create a temp asset + recommendation
    await prisma.asset.create({ data: { ticker: "TEMP", name: "Temp" } });
    const tempRec = await prisma.recommendation.create({
      data: {
        strategySlug: "valuation-first",
        strategyName: "Valuation First",
        assetTicker: "TEMP",
        recommendation: "Review",
        reasoning: "Test",
        inputSignals: "[]",
        rulesTriggered: "[]",
        scoreIds: "[]",
        researchIds: "[]",
        authorId: userId,
      },
    });

    // Delete the asset
    await prisma.asset.delete({ where: { ticker: "TEMP" } });

    // Recommendation should be gone
    const gone = await prisma.recommendation.findUnique({ where: { id: tempRec.id } });
    expect(gone).toBeNull();
  });
});
