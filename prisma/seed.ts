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
