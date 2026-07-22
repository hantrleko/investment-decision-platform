/**
 * Map technical indicators → Trend framework factor scores (0–10).
 * Inspired by Minervini Trend Template + phase classification.
 */

import type { FactorScore } from "@/lib/scoring/compute";
import type { TrendIndicators } from "./indicators";
import { clamp, fmtNum, fmtPct, linearMap, round1 } from "./scoring-utils";

export interface TrendMapperResult {
  factorScores: Record<string, FactorScore>;
  metricsUsed: Record<string, number | string | null>;
  warnings: string[];
}

/** price_structure from Minervini pass count + phase. */
function scorePriceStructure(ind: TrendIndicators): { score: number; note: string } {
  // 0–8 criteria → 0–10
  const minerviniScore = linearMap(ind.minerviniPassCount, 0, 8);

  // Phase bonus/penalty
  const phaseAdj =
    ind.phase === 2 ? 1.0 : ind.phase === 1 ? 0 : ind.phase === 3 ? -1.0 : -2.0;

  // SMA alignment soft signal
  let align = 5;
  if (ind.sma50 != null && ind.sma150 != null && ind.sma200 != null) {
    if (ind.price > ind.sma50 && ind.sma50 > ind.sma150 && ind.sma150 > ind.sma200) {
      align = 9;
    } else if (ind.price > ind.sma200 && ind.sma50 > ind.sma200) {
      align = 7;
    } else if (ind.price < ind.sma200 && ind.sma50 < ind.sma200) {
      align = 2;
    } else {
      align = 5;
    }
  }

  const raw = minerviniScore * 0.55 + align * 0.35 + (5 + phaseAdj) * 0.1;
  const score = round1(clamp(raw, 0, 10));

  const note = [
    `Minervini ${ind.minerviniPassCount}/8`,
    ind.phaseName,
    ind.sma50 != null ? `SMA50 ${fmtNum(ind.sma50)}` : null,
    ind.sma200 != null ? `SMA200 ${fmtNum(ind.sma200)}` : null,
    `price ${fmtNum(ind.price)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/** momentum_signal from RSI + 63d return. */
function scoreMomentum(ind: TrendIndicators): { score: number; note: string } {
  // RSI: sweet spot 50–70 for trend following; <30 oversold bounce potential still ok
  let rsiScore: number | null = null;
  if (ind.rsi14 != null) {
    if (ind.rsi14 >= 45 && ind.rsi14 <= 70) {
      rsiScore = linearMap(ind.rsi14, 45, 65, 6, 9.5);
    } else if (ind.rsi14 > 70) {
      // Overbought — still momentum but risk of pullback
      rsiScore = linearMap(ind.rsi14, 70, 90, 7, 4);
    } else {
      // Weak momentum
      rsiScore = linearMap(ind.rsi14, 20, 45, 2, 6);
    }
  }

  const retScore =
    ind.return63d != null ? linearMap(ind.return63d, -0.2, 0.35) : null;

  // SMA200 slope as longer-term momentum
  const slopeScore =
    ind.sma200Slope20d != null
      ? linearMap(ind.sma200Slope20d, -0.03, 0.04)
      : null;

  const parts = [rsiScore, retScore, slopeScore].filter(
    (v): v is number => v != null
  );
  const score =
    parts.length > 0
      ? round1(clamp(parts.reduce((a, b) => a + b, 0) / parts.length, 0, 10))
      : 5;

  const note = [
    ind.rsi14 != null ? `RSI14 ${fmtNum(ind.rsi14, 1)}` : "RSI n/a",
    ind.return63d != null ? `63d ret ${fmtPct(ind.return63d)}` : null,
    ind.sma200Slope20d != null
      ? `SMA200 slope ${fmtPct(ind.sma200Slope20d)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/** volume_confirmation. */
function scoreVolume(ind: TrendIndicators): { score: number; note: string } {
  let score = 5;
  if (ind.volumeRatio != null) {
    // Rising volume with uptrend is good; high volume in downtrend is distribution
    if (ind.phase === 2 || ind.phase === 1) {
      // Prefer volume expansion on advances
      score = linearMap(ind.volumeRatio, 0.6, 1.8, 3, 9);
    } else if (ind.phase === 3 || ind.phase === 4) {
      // High volume on decline is worse
      score = linearMap(ind.volumeRatio, 0.6, 1.8, 6, 2);
    } else {
      score = linearMap(ind.volumeRatio, 0.7, 1.5);
    }
  }

  const note =
    ind.volumeRatio != null
      ? `vol ratio (5d/50d) ${fmtNum(ind.volumeRatio)} · phase ${ind.phase}`
      : "volume n/a";

  return { score: round1(clamp(score, 0, 10)), note };
}

/** relative_strength vs SPY. */
function scoreRS(ind: TrendIndicators): { score: number; note: string } {
  const score =
    ind.relativeStrengthScore != null
      ? round1(clamp(ind.relativeStrengthScore, 0, 10))
      : 5;

  const note = [
    ind.return63d != null ? `stock 63d ${fmtPct(ind.return63d)}` : "stock 63d n/a",
    ind.spyReturn63d != null ? `SPY 63d ${fmtPct(ind.spyReturn63d)}` : "SPY n/a",
    ind.relativeStrengthScore != null
      ? `RS score ${fmtNum(ind.relativeStrengthScore, 1)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

export function mapTrendFactors(ind: TrendIndicators): TrendMapperResult {
  const warnings: string[] = [];
  if (ind.sma200 == null) {
    warnings.push("Insufficient history for SMA200 — structure partially estimated");
  }
  if (ind.relativeStrengthScore == null) {
    warnings.push("SPY benchmark unavailable — RS defaulted to mid");
  }

  const structure = scorePriceStructure(ind);
  const momentum = scoreMomentum(ind);
  const volume = scoreVolume(ind);
  const rs = scoreRS(ind);

  return {
    factorScores: {
      price_structure: { value: structure.score, note: structure.note },
      momentum_signal: { value: momentum.score, note: momentum.note },
      volume_confirmation: { value: volume.score, note: volume.note },
      relative_strength: { value: rs.score, note: rs.note },
    },
    metricsUsed: {
      phase: ind.phaseName,
      minerviniPassCount: ind.minerviniPassCount,
      sma50: ind.sma50,
      sma150: ind.sma150,
      sma200: ind.sma200,
      rsi14: ind.rsi14,
      return63d: ind.return63d,
      spyReturn63d: ind.spyReturn63d,
      volumeRatio: ind.volumeRatio,
      week52Position: ind.week52Position,
      minerviniDetails: ind.minerviniDetails.join("; "),
    },
    warnings,
  };
}
