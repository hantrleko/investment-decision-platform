"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  getStrategy,
  listStrategies,
  type StrategyInput,
  type StrategyOutput,
  type StrategyConfig,
  type ConfigField,
} from "@/lib/strategies";
import { createDecision } from "@/actions/decisions";
import { revalidatePath } from "next/cache";

export interface StrategyInfo {
  slug: string;
  name: string;
  description: string;
  version: string;
  requiredFrameworkSlugs: string[];
  active: boolean;
  config: StrategyConfig;
  configSchema: ConfigField[];
}

/** Ensure a StrategyConfig row exists for every registered strategy. Creates defaults if missing. */
export async function ensureStrategyConfigs() {
  const existing = await prisma.strategyConfig.findMany();
  const existingSlugs = new Set(existing.map((c) => c.slug));

  for (const s of listStrategies()) {
    if (!existingSlugs.has(s.slug)) {
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
  }
}

export async function getAvailableStrategies(): Promise<StrategyInfo[]> {
  await ensureStrategyConfigs();
  const configs = await prisma.strategyConfig.findMany();
  const configMap = new Map(configs.map((c) => [c.slug, c]));

  return listStrategies().map((s) => {
    const dbConfig = configMap.get(s.slug);
    return {
      slug: s.slug,
      name: s.name,
      description: s.description,
      version: dbConfig?.version ?? s.version,
      requiredFrameworkSlugs: s.requiredFrameworkSlugs,
      active: dbConfig?.active ?? true,
      config: dbConfig ? JSON.parse(dbConfig.config) : s.defaultConfig,
      configSchema: s.configSchema,
    };
  });
}

export async function getStrategyConfig(slug: string): Promise<StrategyInfo | null> {
  const s = getStrategy(slug);
  if (!s) return null;

  const dbConfig = await prisma.strategyConfig.findUnique({ where: { slug } });

  return {
    slug: s.slug,
    name: s.name,
    description: s.description,
    version: dbConfig?.version ?? s.version,
    requiredFrameworkSlugs: s.requiredFrameworkSlugs,
    active: dbConfig?.active ?? true,
    config: dbConfig ? JSON.parse(dbConfig.config) : s.defaultConfig,
    configSchema: s.configSchema,
  };
}

export async function updateStrategyConfig(input: {
  slug: string;
  config: Record<string, string>;
  note?: string;
  experimentLabel?: string;
}) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const strategy = getStrategy(input.slug);
  if (!strategy) {
    return { error: `Strategy "${input.slug}" not found` };
  }

  // Convert form string values to proper types based on configSchema
  const newConfig: StrategyConfig = { ...strategy.defaultConfig };
  for (const field of strategy.configSchema) {
    const raw = input.config[field.key];
    if (raw === undefined || raw === "") continue;
    if (field.type === "number") {
      const n = Number(raw);
      if (isNaN(n)) {
        return { error: `Invalid number for ${field.label}` };
      }
      newConfig[field.key] = n;
    } else if (field.type === "boolean") {
      newConfig[field.key] = raw === "true" || raw === "on";
    } else {
      newConfig[field.key] = raw;
    }
  }

  const configJson = JSON.stringify(newConfig);

  const updated = await prisma.strategyConfig.update({
    where: { slug: input.slug },
    data: {
      config: configJson,
      version: strategy.version,
    },
  });

  // Create config history record
  const history = await prisma.strategyConfigHistory.create({
    data: {
      strategySlug: input.slug,
      strategyName: strategy.name,
      configSnapshot: configJson,
      note: input.note || null,
      experimentLabel: input.experimentLabel || null,
    },
  });

  revalidatePath("/strategies");
  revalidatePath(`/strategies/${input.slug}`);
  return { data: updated, historyId: history.id };
}

export async function toggleStrategyActive(input: { slug: string }) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const existing = await prisma.strategyConfig.findUnique({ where: { slug: input.slug } });
  if (!existing) {
    return { error: "Strategy config not found" };
  }

  const updated = await prisma.strategyConfig.update({
    where: { slug: input.slug },
    data: { active: !existing.active },
  });

  revalidatePath("/strategies");
  revalidatePath(`/strategies/${input.slug}`);
  return { data: updated };
}

export async function runStrategy(input: { strategySlug: string; assetTicker: string }) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;

  const strategy = getStrategy(input.strategySlug);
  if (!strategy) {
    return { error: `Strategy "${input.strategySlug}" not found` };
  }

  // Load DB-backed config
  await ensureStrategyConfigs();
  const dbConfig = await prisma.strategyConfig.findUnique({
    where: { slug: input.strategySlug },
  });

  if (dbConfig && !dbConfig.active) {
    return { error: `Strategy "${strategy.name}" is inactive and cannot be run` };
  }

  const config: StrategyConfig = dbConfig
    ? JSON.parse(dbConfig.config)
    : strategy.defaultConfig;
  const version = dbConfig?.version ?? strategy.version;

  // Find the most recent config history record for this strategy
  const latestHistory = await prisma.strategyConfigHistory.findFirst({
    where: { strategySlug: input.strategySlug },
    orderBy: { createdAt: "desc" },
  });

  const asset = await prisma.asset.findUnique({
    where: { ticker: input.assetTicker },
  });
  if (!asset) {
    return { error: `Asset "${input.assetTicker}" not found` };
  }

  // Gather scores for this asset
  const scores = await prisma.score.findMany({
    where: { assetTicker: input.assetTicker },
    select: {
      id: true,
      compositeScore: true,
      manualOverride: true,
      factorScores: true,
      scoredAt: true,
      framework: { select: { slug: true, name: true } },
    },
    orderBy: { scoredAt: "desc" },
  });

  // Gather research for this asset
  const researchArtifacts = await prisma.researchArtifact.findMany({
    where: { assetTicker: input.assetTicker },
    select: { id: true, title: true, tags: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Build strategy input (use most recent score per framework)
  const seenSlugs = new Set<string>();
  const dedupedScores = scores.filter((s) => {
    if (seenSlugs.has(s.framework.slug)) return false;
    seenSlugs.add(s.framework.slug);
    return true;
  });

  const strategyInput: StrategyInput = {
    assetTicker: input.assetTicker,
    scores: dedupedScores.map((s) => ({
      id: s.id,
      frameworkSlug: s.framework.slug,
      frameworkName: s.framework.name,
      compositeScore: s.compositeScore,
      manualOverride: s.manualOverride,
      factorScores: JSON.parse(s.factorScores) as Record<string, { value: number; note?: string }>,
      scoredAt: s.scoredAt,
    })),
    researchArtifacts: researchArtifacts.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      updatedAt: r.updatedAt,
    })),
  };

  // Run the strategy with config
  const output: StrategyOutput = strategy.evaluate(strategyInput, config);

  // Save the recommendation with config snapshot + history link
  const recommendation = await prisma.recommendation.create({
    data: {
      strategySlug: strategy.slug,
      strategyName: strategy.name,
      strategyVersion: version,
      configSnapshot: JSON.stringify(config),
      configHistoryId: latestHistory?.id ?? null,
      assetTicker: input.assetTicker,
      recommendation: output.recommendation,
      reasoning: output.reasoning,
      inputSignals: JSON.stringify(output.inputSignals),
      rulesTriggered: JSON.stringify(output.rulesTriggered),
      scoreIds: JSON.stringify(output.scoreIds),
      researchIds: JSON.stringify(output.researchIds),
      authorId: session.user.id,
    },
  });

  revalidatePath("/strategies");
  revalidatePath(`/assets/${input.assetTicker}`);
  return { data: recommendation };
}

export async function convertRecommendationToDecision(input: { recommendationId: string }) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const rec = await prisma.recommendation.findUnique({
    where: { id: input.recommendationId },
  });
  if (!rec) {
    return { error: "Recommendation not found" };
  }
  if (rec.convertedDecisionId) {
    return { error: "This recommendation has already been converted to a decision" };
  }

  // Map recommendation level to direction
  const directionMap: Record<string, "bullish" | "bearish" | "neutral"> = {
    "Strong Buy": "bullish",
    Buy: "bullish",
    Watch: "neutral",
    Review: "neutral",
    Avoid: "bearish",
    Reject: "bearish",
  };

  const direction = directionMap[rec.recommendation] || "neutral";
  const scoreIds: string[] = JSON.parse(rec.scoreIds);
  const researchIds: string[] = JSON.parse(rec.researchIds);

  // Create the decision
  const decisionResult = await createDecision({
    title: `[${rec.strategyName}] ${rec.recommendation} — ${rec.assetTicker}`,
    direction,
    thesis: rec.reasoning,
    researchArtifactIds: researchIds,
    scoreIds,
  });

  if (decisionResult.error || !decisionResult.data) {
    return { error: decisionResult.error || "Failed to create decision" };
  }

  // Link recommendation to decision
  await prisma.recommendation.update({
    where: { id: input.recommendationId },
    data: { convertedDecisionId: decisionResult.data.id },
  });

  revalidatePath(`/recommendations/${input.recommendationId}`);
  revalidatePath("/strategies");
  return { data: { recommendationId: input.recommendationId, decisionId: decisionResult.data.id } };
}
