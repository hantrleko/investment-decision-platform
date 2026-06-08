import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeComposite } from "@/lib/scoring/compute";
import { parseSchemaDefinition } from "@/lib/scoring/schema-parser";
import { buildProvenance } from "@/lib/scoring/provenance";
import type { FrameworkSchema } from "@/lib/scoring/compute";

const TEST_DB_URL = "file:./test-scoring.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;
let assetTicker: string;
let frameworkId: string;
let valuationSchema: FrameworkSchema;

const VALUATION_JSON = JSON.stringify({
  version: 1,
  factors: [
    { slug: "intrinsic_value_discount", label: "Intrinsic Value Discount", description: "Test", weight: 0.3, range: { min: 0, max: 10 } },
    { slug: "margin_of_safety", label: "Margin of Safety", description: "Test", weight: 0.25, range: { min: 0, max: 10 } },
    { slug: "catalyst_clarity", label: "Catalyst Clarity", description: "Test", weight: 0.2, range: { min: 0, max: 10 } },
    { slug: "quality_moat", label: "Quality / Moat", description: "Test", weight: 0.15, range: { min: 0, max: 10 } },
    { slug: "sentiment_contrarian", label: "Sentiment", description: "Test", weight: 0.1, range: { min: 0, max: 10 } },
  ],
  compositeMethod: "weighted_average",
});

const MACRO_JSON = JSON.stringify({
  version: 1,
  factors: [
    { slug: "regime_alignment", label: "Regime Alignment", description: "Test", weight: 0.3, range: { min: 0, max: 10 } },
    { slug: "rate_sensitivity", label: "Rate Sensitivity", description: "Test", weight: 0.25, range: { min: 0, max: 10 } },
    { slug: "fiscal_tailwind", label: "Fiscal Tailwind", description: "Test", weight: 0.25, range: { min: 0, max: 10 } },
    { slug: "geopolitical_risk", label: "Geopolitical Risk", description: "Test", weight: 0.2, range: { min: 0, max: 10 } },
  ],
  compositeMethod: "weighted_average",
});

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();

  const user = await prisma.user.create({
    data: { email: "test-scoring@eugene.finance", name: "Tester", passwordHash: await bcrypt.hash("test", 12) },
  });
  userId = user.id;

  const asset = await prisma.asset.create({
    data: { ticker: "SCOR", name: "Scoring Corp", sector: "Finance" },
  });
  assetTicker = asset.ticker;

  const fw = await prisma.framework.create({
    data: { name: "Valuation", slug: "valuation", schemaDefinition: VALUATION_JSON },
  });
  frameworkId = fw.id;

  await prisma.framework.create({
    data: { name: "Macro", slug: "macro", schemaDefinition: MACRO_JSON },
  });

  valuationSchema = parseSchemaDefinition(VALUATION_JSON);
});

afterAll(async () => {
  await prisma.score.deleteMany({});
  await prisma.researchArtifact.deleteMany({});
  await prisma.framework.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("Score creation with provenance", () => {
  it("creates a score with computed composite", async () => {
    const factorScores = {
      intrinsic_value_discount: { value: 8 },
      margin_of_safety: { value: 7 },
      catalyst_clarity: { value: 6 },
      quality_moat: { value: 9 },
      sentiment_contrarian: { value: 5 },
    };

    const composite = computeComposite(valuationSchema, factorScores);
    const provenance = buildProvenance("manual", { note: "Scored via Valuation framework" });

    const score = await prisma.score.create({
      data: {
        frameworkId,
        assetTicker,
        factorScores: JSON.stringify(factorScores),
        compositeScore: composite,
        provenance,
      },
    });

    expect(score.compositeScore).not.toBeNull();
    expect(score.compositeScore!.toFixed(2)).toBe(composite.toFixed(2));
    expect(score.manualOverride).toBe(false);
    expect(score.researchArtifactId).toBeNull();

    // Verify provenance is valid JSON
    const prov = JSON.parse(score.provenance);
    expect(prov.source).toBe("manual");
    expect(prov.timestamp).toBeDefined();
  });

  it("creates a score linked to a research artifact", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: { title: "SCOR Analysis", content: "test", assetTicker, authorId: userId },
    });

    const factorScores = { regime_alignment: { value: 7 }, rate_sensitivity: { value: 6 }, fiscal_tailwind: { value: 8 }, geopolitical_risk: { value: 5 } };
    const macroFw = await prisma.framework.findFirst({ where: { slug: "macro" } });
    const provenance = buildProvenance("research", { artifactId: artifact.id });

    const score = await prisma.score.create({
      data: {
        frameworkId: macroFw!.id,
        assetTicker,
        factorScores: JSON.stringify(factorScores),
        compositeScore: 6.5,
        researchArtifactId: artifact.id,
        provenance,
      },
    });

    expect(score.researchArtifactId).toBe(artifact.id);
    const prov = JSON.parse(score.provenance);
    expect(prov.source).toBe("research");
    expect(prov.artifactId).toBe(artifact.id);
  });
});

describe("Manual override behavior", () => {
  it("sets manualOverride flag and preserves override note", async () => {
    const factorScores = { intrinsic_value_discount: { value: 5 }, margin_of_safety: { value: 5 }, catalyst_clarity: { value: 5 }, quality_moat: { value: 5 }, sentiment_contrarian: { value: 5 } };

    const score = await prisma.score.create({
      data: {
        frameworkId,
        assetTicker,
        factorScores: JSON.stringify(factorScores),
        compositeScore: 5.0,
        provenance: buildProvenance("manual"),
      },
    });

    expect(score.manualOverride).toBe(false);

    // Override
    const overridden = await prisma.score.update({
      where: { id: score.id },
      data: {
        compositeScore: 8.5,
        manualOverride: true,
        overrideNote: "Qualitative adjustment for upcoming catalyst",
      },
    });

    expect(overridden.manualOverride).toBe(true);
    expect(overridden.compositeScore).toBe(8.5);
    expect(overridden.overrideNote).toBe("Qualitative adjustment for upcoming catalyst");
  });
});

describe("Multiple scores per framework per asset", () => {
  it("allows multiple scores; most recent is current", async () => {
    const factorScores1 = { intrinsic_value_discount: { value: 6 }, margin_of_safety: { value: 5 }, catalyst_clarity: { value: 4 }, quality_moat: { value: 7 }, sentiment_contrarian: { value: 3 } };
    const factorScores2 = { intrinsic_value_discount: { value: 9 }, margin_of_safety: { value: 8 }, catalyst_clarity: { value: 7 }, quality_moat: { value: 9 }, sentiment_contrarian: { value: 6 } };

    await prisma.score.create({
      data: {
        frameworkId,
        assetTicker,
        factorScores: JSON.stringify(factorScores1),
        compositeScore: computeComposite(valuationSchema, factorScores1),
        provenance: buildProvenance("manual"),
      },
    });

    await prisma.score.create({
      data: {
        frameworkId,
        assetTicker,
        factorScores: JSON.stringify(factorScores2),
        compositeScore: computeComposite(valuationSchema, factorScores2),
        provenance: buildProvenance("manual", { note: "Updated assessment" }),
      },
    });

    const scores = await prisma.score.findMany({
      where: { frameworkId, assetTicker },
      orderBy: { scoredAt: "desc" },
    });

    expect(scores.length).toBeGreaterThanOrEqual(2);
    // Most recent score has higher composite
    const latest = scores[0];
    const schema = parseSchemaDefinition(VALUATION_JSON);
    const expectedLatest = computeComposite(schema, factorScores2);
    expect(latest.compositeScore).toBeCloseTo(expectedLatest, 1);
  });
});

describe("Score history grouping by framework", () => {
  it("groups scores by framework slug", async () => {
    const allScores = await prisma.score.findMany({
      where: { assetTicker },
      include: { framework: { select: { name: true, slug: true } } },
      orderBy: { scoredAt: "desc" },
    });

    const grouped = new Map<string, typeof allScores>();
    for (const s of allScores) {
      const key = s.framework.slug;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }

    expect(grouped.has("valuation")).toBe(true);
    expect(grouped.has("macro")).toBe(true);
    expect(grouped.get("valuation")!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Side-by-side comparison data", () => {
  it("extracts latest score per framework for comparison", async () => {
    const allScores = await prisma.score.findMany({
      where: { assetTicker },
      include: { framework: { select: { slug: true, name: true } } },
      orderBy: { scoredAt: "desc" },
    });

    const grouped = new Map<string, typeof allScores>();
    for (const s of allScores) {
      const key = s.framework.slug;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }

    const latestPerFramework = Array.from(grouped.values()).map((scores) => scores[0]);
    expect(latestPerFramework.length).toBeGreaterThanOrEqual(2);

    // Each has composite and factor data
    for (const score of latestPerFramework) {
      expect(score.compositeScore).not.toBeNull();
      const factors = JSON.parse(score.factorScores);
      expect(Object.keys(factors).length).toBeGreaterThan(0);
    }
  });
});
