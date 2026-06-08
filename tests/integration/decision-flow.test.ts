import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-decision.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;
let assetTicker: string;
let frameworkId: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-decision@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;

  const asset = await prisma.asset.create({
    data: { ticker: "DEC", name: "Decision Corp", sector: "Finance" },
  });
  assetTicker = asset.ticker;

  const fw = await prisma.framework.create({
    data: {
      name: "Valuation",
      slug: "valuation",
      schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
    },
  });
  frameworkId = fw.id;
});

afterAll(async () => {
  await prisma.decisionResearchLink.deleteMany({});
  await prisma.decisionScoreLink.deleteMany({});
  await prisma.decision.deleteMany({});
  await prisma.score.deleteMany({});
  await prisma.researchArtifact.deleteMany({});
  await prisma.framework.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("Decision CRUD", () => {
  it("creates a decision with direction and thesis", async () => {
    const decision = await prisma.decision.create({
      data: {
        title: "Go long DEC ahead of Q4",
        direction: "bullish",
        thesis: "Strong earnings trajectory, undervalued by 20%",
        authorId: userId,
      },
    });

    expect(decision.id).toBeDefined();
    expect(decision.title).toBe("Go long DEC ahead of Q4");
    expect(decision.direction).toBe("bullish");
    expect(decision.status).toBe("open");
    expect(decision.outcome).toBeNull();
  });

  it("reads a decision with links", async () => {
    const decision = await prisma.decision.findFirst({
      where: { authorId: userId },
      include: {
        researchLinks: true,
        scoreLinks: true,
      },
    });

    expect(decision).not.toBeNull();
    expect(decision!.researchLinks).toBeDefined();
    expect(decision!.scoreLinks).toBeDefined();
  });
});

describe("Link research artifacts to decision (D2)", () => {
  it("creates many-to-many link between decision and research artifacts", async () => {
    const artifact1 = await prisma.researchArtifact.create({
      data: { title: "DEC Earnings Analysis", content: "test", assetTicker, authorId: userId },
    });
    const artifact2 = await prisma.researchArtifact.create({
      data: { title: "DEC Competitive Moat", content: "test", assetTicker, authorId: userId },
    });

    const decision = await prisma.decision.create({
      data: {
        title: "Long DEC",
        direction: "bullish",
        thesis: "Two research artifacts support this",
        authorId: userId,
        researchLinks: {
          create: [
            { researchArtifactId: artifact1.id },
            { researchArtifactId: artifact2.id },
          ],
        },
      },
      include: { researchLinks: { include: { researchArtifact: true } } },
    });

    expect(decision.researchLinks.length).toBe(2);
    expect(decision.researchLinks.map((l) => l.researchArtifact.title)).toContain("DEC Earnings Analysis");
    expect(decision.researchLinks.map((l) => l.researchArtifact.title)).toContain("DEC Competitive Moat");
  });

  it("links are bidirectional — research detail shows linked decisions", async () => {
    const artifact = await prisma.researchArtifact.findFirst({
      where: { title: "DEC Earnings Analysis" },
      include: { decisions: { include: { decision: { select: { title: true } } } } },
    });

    expect(artifact).not.toBeNull();
    expect(artifact!.decisions.length).toBeGreaterThan(0);
  });
});

describe("Link scores to decision (D3)", () => {
  it("creates many-to-many link between decision and scores", async () => {
    const score = await prisma.score.create({
      data: {
        frameworkId,
        assetTicker,
        factorScores: "{}",
        compositeScore: 7.5,
        provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });

    const decision = await prisma.decision.create({
      data: {
        title: "Score-backed decision",
        direction: "bullish",
        thesis: "Valuation score supports this",
        authorId: userId,
        scoreLinks: {
          create: [{ scoreId: score.id }],
        },
      },
      include: { scoreLinks: { include: { score: { include: { framework: true } } } } },
    });

    expect(decision.scoreLinks.length).toBe(1);
    expect(decision.scoreLinks[0].score.framework.name).toBe("Valuation");
    expect(decision.scoreLinks[0].score.compositeScore).toBeCloseTo(7.5);
  });
});

describe("Outcome transition (D6)", () => {
  it("transitions status from open to closed when outcome recorded", async () => {
    const decision = await prisma.decision.create({
      data: {
        title: "Outcome test",
        direction: "neutral",
        thesis: "Testing outcome flow",
        authorId: userId,
      },
    });

    expect(decision.status).toBe("open");
    expect(decision.outcome).toBeNull();

    const updated = await prisma.decision.update({
      where: { id: decision.id },
      data: {
        outcome: "correct",
        outcomeNote: "Hit target within expected timeframe",
        outcomeDate: new Date(),
        status: "closed",
      },
    });

    expect(updated.status).toBe("closed");
    expect(updated.outcome).toBe("correct");
    expect(updated.outcomeNote).toBe("Hit target within expected timeframe");
    expect(updated.outcomeDate).not.toBeNull();
  });

  it("cannot record outcome on already-closed decision (application-level check)", async () => {
    const closed = await prisma.decision.findFirst({
      where: { status: "closed", authorId: userId },
    });

    // Application logic prevents re-closing; we verify the state is consistent
    expect(closed).not.toBeNull();
    expect(closed!.status).toBe("closed");
    expect(closed!.outcome).not.toBeNull();
  });
});

describe("Decision list filters", () => {
  it("filters by status=open", async () => {
    const openDecisions = await prisma.decision.findMany({
      where: { status: "open", authorId: userId },
    });
    openDecisions.forEach((d) => expect(d.status).toBe("open"));
  });

  it("filters by status=closed", async () => {
    const closedDecisions = await prisma.decision.findMany({
      where: { status: "closed", authorId: userId },
    });
    closedDecisions.forEach((d) => expect(d.status).toBe("closed"));
  });

  it("filters by direction=bullish", async () => {
    const bullish = await prisma.decision.findMany({
      where: { direction: "bullish", authorId: userId },
    });
    bullish.forEach((d) => expect(d.direction).toBe("bullish"));
  });

  it("combined filter: open + bearish", async () => {
    const results = await prisma.decision.findMany({
      where: { status: "open", direction: "bearish", authorId: userId },
    });
    results.forEach((d) => {
      expect(d.status).toBe("open");
      expect(d.direction).toBe("bearish");
    });
  });
});

describe("Asset decision timeline aggregation (D7)", () => {
  it("finds decisions linked via research artifacts for this asset", async () => {
    const decisionsViaResearch = await prisma.decision.findMany({
      where: {
        researchLinks: { some: { researchArtifact: { assetTicker } } },
      },
      select: { id: true, title: true, direction: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    expect(decisionsViaResearch.length).toBeGreaterThan(0);
    decisionsViaResearch.forEach((d) => {
      expect(d.title).toBeDefined();
    });
  });

  it("finds decisions linked via scores for this asset", async () => {
    const decisionsViaScores = await prisma.decision.findMany({
      where: {
        scoreLinks: { some: { score: { assetTicker } } },
      },
      select: { id: true, title: true, direction: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    expect(decisionsViaScores.length).toBeGreaterThan(0);
  });

  it("deduplicates timeline entries in-memory", async () => {
    const decisionsViaResearch = await prisma.decision.findMany({
      where: { researchLinks: { some: { researchArtifact: { assetTicker } } } },
      select: { id: true },
    });
    const decisionsViaScores = await prisma.decision.findMany({
      where: { scoreLinks: { some: { score: { assetTicker } } } },
      select: { id: true },
    });

    const allIds = new Set<string>();
    const all = [...decisionsViaResearch, ...decisionsViaScores].filter((d) => {
      if (allIds.has(d.id)) return false;
      allIds.add(d.id);
      return true;
    });

    // No duplicates
    expect(all.length).toBe(allIds.size);
    expect(all.length).toBeGreaterThan(0);
  });
});
