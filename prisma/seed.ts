import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const VALUATION_SCHEMA = {
  version: 1,
  factors: [
    {
      slug: "intrinsic_value_discount",
      label: "Intrinsic Value Discount",
      description: "How large is the discount to intrinsic value?",
      weight: 0.3,
      range: { min: 0, max: 10 },
    },
    {
      slug: "margin_of_safety",
      label: "Margin of Safety",
      description: "Is there a meaningful margin of safety?",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "catalyst_clarity",
      label: "Catalyst Clarity",
      description: "Are there identifiable near-term catalysts?",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
    {
      slug: "quality_moat",
      label: "Quality / Moat",
      description: "Does the asset have durable competitive advantages?",
      weight: 0.15,
      range: { min: 0, max: 10 },
    },
    {
      slug: "sentiment_contrarian",
      label: "Sentiment / Contrarian Signal",
      description: "Is sentiment overly negative (bullish) or positive (bearish)?",
      weight: 0.1,
      range: { min: 0, max: 10 },
    },
  ],
  compositeMethod: "weighted_average",
};

const MACRO_SCHEMA = {
  version: 1,
  factors: [
    {
      slug: "regime_alignment",
      label: "Regime Alignment",
      description: "Does the current macro regime favor this asset?",
      weight: 0.3,
      range: { min: 0, max: 10 },
    },
    {
      slug: "rate_sensitivity",
      label: "Rate Sensitivity",
      description: "How does the interest rate environment affect this asset?",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "fiscal_tailwind",
      label: "Fiscal Tailwind",
      description: "Are fiscal policies supportive of this asset?",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "geopolitical_risk",
      label: "Geopolitical Risk (Inverse)",
      description: "How exposed is this asset to geopolitical disruption? (Higher = less risk)",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
  ],
  compositeMethod: "weighted_average",
};

const TREND_SCHEMA = {
  version: 1,
  factors: [
    {
      slug: "price_structure",
      label: "Price Structure",
      description: "Is the price structure constructive (higher highs, higher lows)?",
      weight: 0.3,
      range: { min: 0, max: 10 },
    },
    {
      slug: "momentum_signal",
      label: "Momentum Signal",
      description: "Are momentum indicators aligned with the trend?",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "volume_confirmation",
      label: "Volume Confirmation",
      description: "Is volume confirming the price move?",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "relative_strength",
      label: "Relative Strength",
      description: "Is this asset outperforming its benchmark or peers?",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
  ],
  compositeMethod: "weighted_average",
};

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@eugene.finance";
  const password = process.env.ADMIN_PASSWORD || "changeme";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Admin", passwordHash },
  });

  console.log(`Seeded user: ${user.email}`);

  const frameworks = [
    {
      name: "Valuation",
      slug: "valuation",
      description:
        "Value-oriented framework assessing discount to intrinsic value, margin of safety, catalysts, quality/moat, and sentiment.",
      schemaDefinition: JSON.stringify(VALUATION_SCHEMA),
    },
    {
      name: "Macro",
      slug: "macro",
      description:
        "Top-down macro framework assessing regime alignment, rate sensitivity, fiscal tailwind, and geopolitical risk.",
      schemaDefinition: JSON.stringify(MACRO_SCHEMA),
    },
    {
      name: "Trend",
      slug: "trend",
      description:
        "Technical/trend framework assessing price structure, momentum, volume confirmation, and relative strength.",
      schemaDefinition: JSON.stringify(TREND_SCHEMA),
    },
  ];

  for (const fw of frameworks) {
    const created = await prisma.framework.upsert({
      where: { slug: fw.slug },
      update: { name: fw.name, description: fw.description, schemaDefinition: fw.schemaDefinition },
      create: fw,
    });
    console.log(`Seeded framework: ${created.name} (${created.slug})`);
  }

  // Seed default strategy configs
  const strategyConfigs = [
    {
      slug: "valuation-first",
      name: "Valuation First",
      description:
        "Prioritizes the Valuation framework score. Requires a Valuation score to run. Strong scores with quality/moat support produce Buy signals.",
      version: "1.0.0",
      config: JSON.stringify({
        strongBuyThreshold: 7.5,
        buyThreshold: 6.0,
        watchThreshold: 4.5,
        reviewThreshold: 3.0,
        researchSupportCount: 2,
      }),
    },
    {
      slug: "trend-confirmed",
      name: "Trend Confirmed",
      description:
        "Uses the Trend framework as primary signal. Requires a Trend score. Looks for momentum and price structure alignment.",
      version: "1.0.0",
      config: JSON.stringify({
        buyThreshold: 7.0,
        watchThreshold: 5.5,
        reviewThreshold: 3.5,
        momentumConfirm: 7,
        priceStructureConfirm: 6,
        momentumDeteriorate: 3,
        priceStructureDeteriorate: 3,
      }),
    },
    {
      slug: "multi-signal-gate",
      name: "Multi-Signal Gate",
      description:
        "Requires at least 2 framework scores. Combines all available scores and research to produce a gated recommendation. More scores = higher confidence.",
      version: "1.0.0",
      config: JSON.stringify({
        minScores: 2,
        strongBuyAvg: 7.0,
        strongBuyMin: 5.0,
        buyAvg: 6.0,
        buyMin: 4.0,
        watchAvg: 4.5,
        reviewAvg: 3.0,
        penaltyThreshold: 3.0,
        researchStrongCount: 3,
      }),
    },
  ];

  for (const sc of strategyConfigs) {
    const created = await prisma.strategyConfig.upsert({
      where: { slug: sc.slug },
      update: { name: sc.name, description: sc.description, version: sc.version },
      create: { ...sc, active: true },
    });
    console.log(`Seeded strategy config: ${created.name} (${created.slug})`);

    // Create initial config history record
    const hist = await prisma.strategyConfigHistory.create({
      data: {
        strategySlug: sc.slug,
        strategyName: sc.name,
        configSnapshot: sc.config,
        note: "Initial default configuration",
      },
    });

    // For valuation-first, also create an experiment config history
    if (sc.slug === "valuation-first") {
      const expConfig = JSON.stringify({
        strongBuyThreshold: 6.0,
        buyThreshold: 4.5,
        watchThreshold: 3.0,
        reviewThreshold: 2.0,
        researchSupportCount: 2,
      });
      const expHist = await prisma.strategyConfigHistory.create({
        data: {
          strategySlug: sc.slug,
          strategyName: sc.name,
          configSnapshot: expConfig,
          note: "Lowered thresholds for aggressive entry testing",
          experimentLabel: "exp-demo-aggressive",
        },
      });
      console.log(`  Created experiment config history: ${expHist.experimentLabel}`);
    }
  }

  // ─── Demo data ──────────────────────────────────────────────
  // Only seed demo data if DEMO_SEED=true (or always, since this is a dev seed)
  console.log("Seeding demo data...");

  // Create demo assets
  const demoAssets = [
    { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", lastPrice: 192.50, priceSource: "manual" },
    { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors", exchange: "NASDAQ", lastPrice: 178.75, priceSource: "manual" },
    { ticker: "MSFT", name: "Microsoft Corporation", sector: "Software", exchange: "NASDAQ", lastPrice: 420.30, priceSource: "manual" },
  ];

  for (const a of demoAssets) {
    await prisma.asset.upsert({
      where: { ticker: a.ticker },
      update: {},
      create: {
        ticker: a.ticker,
        name: a.name,
        sector: a.sector,
        exchange: a.exchange,
        lastPrice: a.lastPrice,
        lastPriceTs: new Date(),
        priceSource: a.priceSource,
      },
    });
  }
  console.log(`Seeded ${demoAssets.length} demo assets`);

  // Create research artifacts
  const research1 = await prisma.researchArtifact.create({
    data: {
      title: "AAPL Q3 2026 Earnings Analysis",
      content: "Apple reported strong Q3 earnings with revenue beating consensus by 4%. iPhone revenue grew 8% YoY, and Services revenue hit a new record. The margin expansion story continues with gross margin reaching 46.5%. Key risks include regulatory pressure on App Store and China market weakness.",
      tags: "earnings,apple,technology",
      assetTicker: "AAPL",
      authorId: user.id,
    },
  });

  const research2 = await prisma.researchArtifact.create({
    data: {
      title: "NVDA Data Center Momentum",
      content: "NVIDIA's data center revenue continues to accelerate, driven by AI training and inference demand. H100 GPU shipments are tracking ahead of expectations. Key question is whether the AI capex cycle sustains through 2027. Valuation is stretched but growth rate justifies a premium.",
      tags: "ai,semiconductors,data-center",
      assetTicker: "NVDA",
      authorId: user.id,
    },
  });

  const research3 = await prisma.researchArtifact.create({
    data: {
      title: "MSFT Cloud Dominance and Copilot Adoption",
      content: "Microsoft's Azure growth remains robust at 29% YoY. Copilot adoption is accelerating in enterprise, with 40% of Fortune 500 now deploying. The Office 365 ARPU expansion from Copilot could add $10B+ in recurring revenue. Key risk is Google's competitive response in AI-powered productivity.",
      tags: "cloud,ai,microsoft",
      assetTicker: "MSFT",
      authorId: user.id,
    },
  });

  console.log("Seeded 3 research artifacts");

  // Create scores for AAPL (Valuation + Trend)
  const valFw = await prisma.framework.findUnique({ where: { slug: "valuation" } });
  const trendFw = await prisma.framework.findUnique({ where: { slug: "trend" } });
  if (!valFw || !trendFw) {
    throw new Error("Frameworks not found — ensure seed ran framework creation first");
  }

  const aaplValScore = await prisma.score.create({
    data: {
      frameworkId: valFw.id,
      assetTicker: "AAPL",
      researchArtifactId: research1.id,
      factorScores: JSON.stringify({
        intrinsic_value_discount: { value: 7 },
        margin_of_safety: { value: 5 },
        catalyst_clarity: { value: 6 },
        quality_moat: { value: 8 },
        sentiment_contrarian: { value: 4 },
      }),
      compositeScore: 6.15,
      provenance: JSON.stringify({ source: "research", timestamp: new Date().toISOString(), artifactId: research1.id }),
    },
  });

  const aaplTrendScore = await prisma.score.create({
    data: {
      frameworkId: trendFw.id,
      assetTicker: "AAPL",
      factorScores: JSON.stringify({
        price_structure: { value: 6 },
        momentum_signal: { value: 7 },
        volume_confirmation: { value: 5 },
        relative_strength: { value: 8 },
      }),
      compositeScore: 6.40,
      provenance: JSON.stringify({ source: "manual", timestamp: new Date().toISOString() }),
    },
  });

  // Create scores for NVDA (Valuation + Trend)
  const nvdaValScore = await prisma.score.create({
    data: {
      frameworkId: valFw.id,
      assetTicker: "NVDA",
      researchArtifactId: research2.id,
      factorScores: JSON.stringify({
        intrinsic_value_discount: { value: 4 },
        margin_of_safety: { value: 3 },
        catalyst_clarity: { value: 8 },
        quality_moat: { value: 9 },
        sentiment_contrarian: { value: 2 },
      }),
      compositeScore: 5.05,
      provenance: JSON.stringify({ source: "research", timestamp: new Date().toISOString(), artifactId: research2.id }),
    },
  });

  const nvdaTrendScore = await prisma.score.create({
    data: {
      frameworkId: trendFw.id,
      assetTicker: "NVDA",
      factorScores: JSON.stringify({
        price_structure: { value: 8 },
        momentum_signal: { value: 9 },
        volume_confirmation: { value: 7 },
        relative_strength: { value: 9 },
      }),
      compositeScore: 8.20,
      provenance: JSON.stringify({ source: "manual", timestamp: new Date().toISOString() }),
    },
  });

  // Create a score for MSFT (Valuation only)
  const msftValScore = await prisma.score.create({
    data: {
      frameworkId: valFw.id,
      assetTicker: "MSFT",
      researchArtifactId: research3.id,
      factorScores: JSON.stringify({
        intrinsic_value_discount: { value: 6 },
        margin_of_safety: { value: 5 },
        catalyst_clarity: { value: 7 },
        quality_moat: { value: 8 },
        sentiment_contrarian: { value: 5 },
      }),
      compositeScore: 6.20,
      provenance: JSON.stringify({ source: "research", timestamp: new Date().toISOString(), artifactId: research3.id }),
    },
  });

  console.log("Seeded 5 scores across 3 assets and 2 frameworks");

  // Create decisions with outcomes
  const aaplDecision = await prisma.decision.create({
    data: {
      title: "AAPL Long Position — Q3 Earnings Play",
      direction: "bullish",
      thesis: "Apple Q3 earnings beat consensus with margin expansion. iPhone revenue recovering. Entry near $190 offers reasonable risk/reward with support at $180.",
      authorId: user.id,
      status: "closed",
      outcome: "correct",
      outcomeNote: "Stock moved to $205 within 3 weeks. Closed position for 7.5% gain.",
      outcomeDate: new Date(),
      scoreLinks: { create: [{ scoreId: aaplValScore.id }, { scoreId: aaplTrendScore.id }] },
      researchLinks: { create: [{ researchArtifactId: research1.id }] },
    },
  });

  const nvdaDecision = await prisma.decision.create({
    data: {
      title: "NVDA Long — AI Momentum Continuation",
      direction: "bullish",
      thesis: "Data center revenue accelerating. H100 demand outstripping supply. Trend is very strong but valuation is stretched. Smaller position size warranted.",
      authorId: user.id,
      status: "open",
      scoreLinks: { create: [{ scoreId: nvdaValScore.id }, { scoreId: nvdaTrendScore.id }] },
      researchLinks: { create: [{ researchArtifactId: research2.id }] },
    },
  });

  console.log("Seeded 2 decisions (1 closed with outcome, 1 open)");

  // Create strategy recommendations
  const defaultHist = await prisma.strategyConfigHistory.findFirst({
    where: { strategySlug: "valuation-first", experimentLabel: null },
    orderBy: { createdAt: "desc" },
  });
  const expHist = await prisma.strategyConfigHistory.findFirst({
    where: { strategySlug: "valuation-first", experimentLabel: "exp-demo-aggressive" },
    orderBy: { createdAt: "desc" },
  });

  // Recommendation 1: AAPL with default config → Buy
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 7.5, buyThreshold: 6.0, watchThreshold: 4.5, reviewThreshold: 3.0, researchSupportCount: 2 }),
      configHistoryId: defaultHist?.id ?? null,
      assetTicker: "AAPL",
      recommendation: "Buy",
      reasoning: "Valuation First strategy evaluated AAPL with a Valuation composite of 6.15. Result: Buy. Valuation composite 6.15 is favorable (>= 6).",
      inputSignals: JSON.stringify([
        { signal: "valuation_composite", value: "6.15" },
        { signal: "valuation_overridden", value: "false" },
        { signal: "research_count", value: "1" },
      ]),
      rulesTriggered: JSON.stringify([{ rule: "composite >= 6", detail: "Valuation composite 6.15 is favorable (>= 6)" }]),
      scoreIds: JSON.stringify([aaplValScore.id]),
      researchIds: JSON.stringify([research1.id]),
      authorId: user.id,
    },
  });

  // Recommendation 2: AAPL with aggressive experiment config → Strong Buy
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 6.0, buyThreshold: 4.5, watchThreshold: 3.0, reviewThreshold: 2.0, researchSupportCount: 2 }),
      configHistoryId: expHist?.id ?? null,
      assetTicker: "AAPL",
      recommendation: "Strong Buy",
      reasoning: "Valuation First strategy evaluated AAPL with a Valuation composite of 6.15. Result: Strong Buy. Valuation composite 6.15 is strong (>= 6).",
      inputSignals: JSON.stringify([
        { signal: "valuation_composite", value: "6.15" },
        { signal: "valuation_overridden", value: "false" },
        { signal: "research_count", value: "1" },
      ]),
      rulesTriggered: JSON.stringify([{ rule: "composite >= 6", detail: "Valuation composite 6.15 is strong (>= 6)" }]),
      scoreIds: JSON.stringify([aaplValScore.id]),
      researchIds: JSON.stringify([research1.id]),
      authorId: user.id,
    },
  });

  // Recommendation 3: NVDA with default config → Watch (composite 5.05)
  await prisma.recommendation.create({
    data: {
      strategySlug: "valuation-first",
      strategyName: "Valuation First",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ strongBuyThreshold: 7.5, buyThreshold: 6.0, watchThreshold: 4.5, reviewThreshold: 3.0, researchSupportCount: 2 }),
      configHistoryId: defaultHist?.id ?? null,
      assetTicker: "NVDA",
      recommendation: "Watch",
      reasoning: "Valuation First strategy evaluated NVDA with a Valuation composite of 5.05. Result: Watch. Valuation composite 5.05 is moderate (>= 4.5), monitor for improvement.",
      inputSignals: JSON.stringify([
        { signal: "valuation_composite", value: "5.05" },
        { signal: "valuation_overridden", value: "false" },
        { signal: "research_count", value: "1" },
      ]),
      rulesTriggered: JSON.stringify([{ rule: "composite >= 4.5", detail: "Valuation composite 5.05 is moderate (>= 4.5), monitor for improvement" }]),
      scoreIds: JSON.stringify([nvdaValScore.id]),
      researchIds: JSON.stringify([research2.id]),
      authorId: user.id,
    },
  });

  // Recommendation 4: Multi-Signal Gate on AAPL → Buy (avg 6.28, min 6.15)
  const msHist = await prisma.strategyConfigHistory.findFirst({
    where: { strategySlug: "multi-signal-gate" },
    orderBy: { createdAt: "desc" },
  });
  await prisma.recommendation.create({
    data: {
      strategySlug: "multi-signal-gate",
      strategyName: "Multi-Signal Gate",
      strategyVersion: "1.0.0",
      configSnapshot: JSON.stringify({ minScores: 2, strongBuyAvg: 7.0, strongBuyMin: 5.0, buyAvg: 6.0, buyMin: 4.0, watchAvg: 4.5, reviewAvg: 3.0, penaltyThreshold: 3.0, researchStrongCount: 3 }),
      configHistoryId: msHist?.id ?? null,
      assetTicker: "AAPL",
      recommendation: "Buy",
      reasoning: "Multi-Signal Gate strategy evaluated AAPL across 2 framework(s). Average composite: 6.28, Minimum: 6.15. Result: Buy. Average composite 6.28 with minimum 6.15 — frameworks mostly aligned.",
      inputSignals: JSON.stringify([
        { signal: "score_count", value: "2" },
        { signal: "research_count", value: "1" },
        { signal: "valuation_composite", value: "6.15" },
        { signal: "trend_composite", value: "6.40" },
      ]),
      rulesTriggered: JSON.stringify([
        { rule: "avg >= 6 AND min >= 4", detail: "Average composite 6.28 with minimum 6.15 — frameworks mostly aligned" },
        { rule: "research_count == 0", detail: "No research artifacts — recommendation based on scores only" },
      ]),
      scoreIds: JSON.stringify([aaplValScore.id, aaplTrendScore.id]),
      researchIds: JSON.stringify([research1.id]),
      authorId: user.id,
    },
  });

  // Link recommendation 4 to the AAPL decision (already closed with correct outcome)
  await prisma.recommendation.update({
    where: { id: (await prisma.recommendation.findFirst({ where: { strategySlug: "multi-signal-gate", assetTicker: "AAPL" }, orderBy: { createdAt: "desc" } }))!.id },
    data: { convertedDecisionId: aaplDecision.id },
  });

  console.log("Seeded 4 strategy recommendations (2 default, 1 experiment, 1 multi-signal)");

  // Add AAPL to watchlist
  await prisma.watchlistEntry.create({
    data: { assetTicker: "AAPL", notes: "Monitoring for post-earnings drift" },
  });
  console.log("Seeded watchlist entry for AAPL");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
