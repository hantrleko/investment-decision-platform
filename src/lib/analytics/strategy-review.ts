import type { RecommendationLevel } from "@/lib/strategies";

export interface StrategySummary {
  slug: string;
  name: string;
  active: boolean;
  totalRecommendations: number;
  convertedCount: number;
  conversionRate: number;
  linkedDecisionsCount: number;
  closedDecisionsCount: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
}

export interface LevelBreakdown {
  level: RecommendationLevel | string;
  total: number;
  converted: number;
  closed: number;
  correct: number;
  incorrect: number;
  partial: number;
}

export interface ReviewItem {
  id: string;
  strategySlug: string;
  strategyName: string;
  assetTicker: string;
  assetName: string;
  recommendation: string;
  createdAt: Date;
  converted: boolean;
  decisionId: string | null;
  decisionStatus: string | null;
  decisionDirection: string | null;
  decisionOutcome: string | null;
}

export interface ReviewData {
  summaries: StrategySummary[];
  levelBreakdowns: LevelBreakdown[];
  items: ReviewItem[];
}

export interface ReviewFilters {
  strategySlug?: string;
  assetTicker?: string;
  recommendationLevel?: string;
  convertedOnly?: boolean;
  unconvertedOnly?: boolean;
  outcome?: string;
}

export function computeConversionRate(total: number, converted: number): number {
  if (total === 0) return 0;
  return converted / total;
}

export function computeStrategySummary(
  slug: string,
  name: string,
  active: boolean,
  recs: Array<{
    id: string;
    convertedDecisionId: string | null;
  }>,
  decisions: Array<{
    id: string;
    status: string;
    outcome: string | null;
  }>
): StrategySummary {
  const totalRecommendations = recs.length;
  const convertedCount = recs.filter((r) => r.convertedDecisionId != null).length;
  const conversionRate = computeConversionRate(totalRecommendations, convertedCount);

  const closedDecisionsCount = decisions.filter((d) => d.status === "closed").length;
  const correctCount = decisions.filter((d) => d.outcome === "correct").length;
  const incorrectCount = decisions.filter((d) => d.outcome === "incorrect").length;
  const partialCount = decisions.filter((d) => d.outcome === "partial").length;

  return {
    slug,
    name,
    active,
    totalRecommendations,
    convertedCount,
    conversionRate,
    linkedDecisionsCount: decisions.length,
    closedDecisionsCount,
    correctCount,
    incorrectCount,
    partialCount,
  };
}

const RECOMMENDATION_LEVELS: string[] = [
  "Strong Buy",
  "Buy",
  "Watch",
  "Review",
  "Avoid",
  "Reject",
];

export function computeLevelBreakdown(
  recs: Array<{
    recommendation: string;
    convertedDecisionId: string | null;
  }>,
  decisionMap: Map<string, { status: string; outcome: string | null }>
): LevelBreakdown[] {
  return RECOMMENDATION_LEVELS.map((level) => {
    const levelRecs = recs.filter((r) => r.recommendation === level);
    const converted = levelRecs.filter((r) => r.convertedDecisionId != null);

    let closed = 0;
    let correct = 0;
    let incorrect = 0;
    let partial = 0;

    for (const r of converted) {
      const dec = r.convertedDecisionId ? decisionMap.get(r.convertedDecisionId) : null;
      if (dec) {
        if (dec.status === "closed") closed++;
        if (dec.outcome === "correct") correct++;
        else if (dec.outcome === "incorrect") incorrect++;
        else if (dec.outcome === "partial") partial++;
      }
    }

    return {
      level,
      total: levelRecs.length,
      converted: converted.length,
      closed,
      correct,
      incorrect,
      partial,
    };
  });
}

export function applyFilters(
  items: ReviewItem[],
  filters: ReviewFilters
): ReviewItem[] {
  return items.filter((item) => {
    if (filters.strategySlug && item.strategySlug !== filters.strategySlug) return false;
    if (filters.assetTicker && item.assetTicker !== filters.assetTicker) return false;
    if (filters.recommendationLevel && item.recommendation !== filters.recommendationLevel) return false;
    if (filters.convertedOnly && !item.converted) return false;
    if (filters.unconvertedOnly && item.converted) return false;
    if (filters.outcome) {
      if (!item.converted || !item.decisionOutcome) return false;
      if (item.decisionOutcome !== filters.outcome) return false;
    }
    return true;
  });
}
