"use server";

import { prisma } from "@/lib/db";
import { listStrategies } from "@/lib/strategies";
import {
  computeStrategySummary,
  computeLevelBreakdown,
  applyFilters,
  type ReviewData,
  type ReviewFilters,
  type ReviewItem,
  type StrategySummary,
  type LevelBreakdown,
} from "@/lib/analytics/strategy-review";

export async function getStrategyReviewData(filters?: ReviewFilters): Promise<ReviewData> {
  // Fetch all recommendations with asset info
  const recs = await prisma.recommendation.findMany({
    select: {
      id: true,
      strategySlug: true,
      strategyName: true,
      assetTicker: true,
      recommendation: true,
      createdAt: true,
      convertedDecisionId: true,
      asset: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all converted decision IDs
  const decisionIds = recs
    .map((r) => r.convertedDecisionId)
    .filter((id): id is string => id != null);

  // Fetch decisions
  const decisions = decisionIds.length > 0
    ? await prisma.decision.findMany({
        where: { id: { in: decisionIds } },
        select: { id: true, status: true, outcome: true, direction: true },
      })
    : [];

  const decisionMap = new Map(decisions.map((d) => [d.id, d]));

  // Fetch strategy configs for active status
  const configs = await prisma.strategyConfig.findMany();
  const configMap = new Map(configs.map((c) => [c.slug, c]));
  const strategyNames = new Map(listStrategies().map((s) => [s.slug, s.name]));

  // Build per-strategy summaries
  const strategySlugs = new Set(recs.map((r) => r.strategySlug));
  // Also include strategies with no recommendations
  for (const s of listStrategies()) {
    strategySlugs.add(s.slug);
  }

  const summaries: StrategySummary[] = [];

  for (const slug of strategySlugs) {
    const slugRecs = recs.filter((r) => r.strategySlug === slug);
    const slugDecisionIds = slugRecs
      .map((r) => r.convertedDecisionId)
      .filter((id): id is string => id != null);
    const slugDecisions = slugDecisionIds
      .map((id) => decisionMap.get(id))
      .filter((d): d is NonNullable<typeof d> => d != null);

    const name = strategyNames.get(slug) ?? slug;
    const active = configMap.get(slug)?.active ?? true;

    summaries.push(
      computeStrategySummary(
        slug,
        name,
        active,
        slugRecs.map((r) => ({ id: r.id, convertedDecisionId: r.convertedDecisionId })),
        slugDecisions.map((d) => ({ id: d.id, status: d.status, outcome: d.outcome }))
      )
    );
  }

  // Sort summaries: strategies with recommendations first, then by name
  summaries.sort((a, b) => {
    if (a.totalRecommendations > 0 && b.totalRecommendations === 0) return -1;
    if (a.totalRecommendations === 0 && b.totalRecommendations > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  // Build level breakdowns across all recommendations
  const levelBreakdowns: LevelBreakdown[] = computeLevelBreakdown(
    recs.map((r) => ({
      recommendation: r.recommendation,
      convertedDecisionId: r.convertedDecisionId,
    })),
    decisionMap
  );

  // Build review items
  const allItems: ReviewItem[] = recs.map((r) => {
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

  // Apply filters to items
  const filteredItems = filters ? applyFilters(allItems, filters) : allItems;

  // If filtering by strategy, also filter summaries
  const filteredSummaries = filters?.strategySlug
    ? summaries.filter((s) => s.slug === filters.strategySlug)
    : summaries;

  return {
    summaries: filteredSummaries,
    levelBreakdowns,
    items: filteredItems,
  };
}

export async function getStrategyReviewDataForSlug(slug: string): Promise<{
  summary: StrategySummary | null;
  items: ReviewItem[];
  levelBreakdowns: LevelBreakdown[];
}> {
  const data = await getStrategyReviewData({ strategySlug: slug });
  return {
    summary: data.summaries.find((s) => s.slug === slug) ?? null,
    items: data.items,
    levelBreakdowns: data.levelBreakdowns,
  };
}
