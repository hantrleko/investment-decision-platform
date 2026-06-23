"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { getStrategy, listStrategies, type StrategyInput, type StrategyOutput } from "@/lib/strategies";
import { createDecision } from "@/actions/decisions";
import { revalidatePath } from "next/cache";

export interface StrategyInfo {
  slug: string;
  name: string;
  description: string;
  version: string;
  requiredFrameworkSlugs: string[];
}

export async function getAvailableStrategies(): Promise<StrategyInfo[]> {
  return listStrategies().map((s) => ({
    slug: s.slug,
    name: s.name,
    description: s.description,
    version: s.version,
    requiredFrameworkSlugs: s.requiredFrameworkSlugs,
  }));
}

export async function runStrategy(input: { strategySlug: string; assetTicker: string }) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const strategy = getStrategy(input.strategySlug);
  if (!strategy) {
    return { error: `Strategy "${input.strategySlug}" not found` };
  }

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

  // Run the strategy
  const output: StrategyOutput = strategy.evaluate(strategyInput);

  // Save the recommendation
  const recommendation = await prisma.recommendation.create({
    data: {
      strategySlug: strategy.slug,
      strategyName: strategy.name,
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
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

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
