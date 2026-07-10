/**
 * Dashboard aggregation helpers.
 *
 * Pure functions that transform raw records into the summary shapes the
 * dashboard renders. DB queries live in the dashboard page/action; these are
 * kept side-effect free for testability.
 */

export interface DecisionOutcomeInput {
  status: string; // "open" | "closed"
  outcome: string | null; // "correct" | "incorrect" | "partial" | null
}

export interface DecisionStats {
  total: number;
  open: number;
  closed: number;
  correct: number;
  incorrect: number;
  partial: number;
  /** Hit rate over *closed* decisions with a definitive outcome (partial = 0.5). */
  hitRatePct: number;
}

export function computeDecisionStats(
  decisions: DecisionOutcomeInput[]
): DecisionStats {
  let open = 0;
  let closed = 0;
  let correct = 0;
  let incorrect = 0;
  let partial = 0;

  for (const d of decisions) {
    if (d.status === "closed") closed++;
    else open++;

    if (d.outcome === "correct") correct++;
    else if (d.outcome === "incorrect") incorrect++;
    else if (d.outcome === "partial") partial++;
  }

  const scored = correct + incorrect + partial;
  const hitRatePct =
    scored === 0
      ? 0
      : Math.round(((correct + partial * 0.5) / scored) * 1000) / 10;

  return {
    total: decisions.length,
    open,
    closed,
    correct,
    incorrect,
    partial,
    hitRatePct,
  };
}

export interface RecommendationLevelInput {
  recommendation: string;
}

/** Count recommendations by level, preserving a stable display order. */
export function countByLevel(
  recs: RecommendationLevelInput[]
): Array<{ level: string; count: number }> {
  const order = [
    "Strong Buy",
    "Buy",
    "Watch",
    "Review",
    "Avoid",
    "Reject",
  ];
  const counts = new Map<string, number>();
  for (const r of recs) {
    counts.set(r.recommendation, (counts.get(r.recommendation) ?? 0) + 1);
  }
  const result: Array<{ level: string; count: number }> = [];
  for (const level of order) {
    if (counts.has(level)) {
      result.push({ level, count: counts.get(level)! });
      counts.delete(level);
    }
  }
  // Any unexpected levels appended after known ones.
  for (const [level, count] of counts) result.push({ level, count });
  return result;
}

export interface HitRateTrendPoint {
  outcomeDate: Date | null;
  outcome: string | null;
}

/**
 * Cumulative hit-rate trend over closed decisions ordered by outcome date.
 * Each point is the running hit rate after that decision resolved.
 */
export function computeHitRateTrend(
  decisions: HitRateTrendPoint[]
): Array<{ date: Date; hitRatePct: number; n: number }> {
  const scored = decisions
    .filter((d) => d.outcomeDate && d.outcome)
    .sort((a, b) => a.outcomeDate!.getTime() - b.outcomeDate!.getTime());

  const out: Array<{ date: Date; hitRatePct: number; n: number }> = [];
  let cumScore = 0;
  let n = 0;
  for (const d of scored) {
    n++;
    if (d.outcome === "correct") cumScore += 1;
    else if (d.outcome === "partial") cumScore += 0.5;
    out.push({
      date: d.outcomeDate!,
      hitRatePct: Math.round((cumScore / n) * 1000) / 10,
      n,
    });
  }
  return out;
}
