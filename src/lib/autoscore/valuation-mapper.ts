/**
 * Map fundamentals → Valuation framework factor scores (0–10).
 * Uses sector-relative grading (Phase 2) with absolute fallbacks (Phase 1).
 */

import type { Fundamentals } from "@/lib/marketdata/yahoo";
import type { FactorScore } from "@/lib/scoring/compute";
import { getSectorBenchmarks } from "./sector-stats";
import {
  avg,
  clamp,
  fmtLarge,
  fmtNum,
  fmtPct,
  gradeMetric,
  linearMap,
  round1,
  weightedAvg,
} from "./scoring-utils";

export interface ValuationMapperResult {
  factorScores: Record<string, FactorScore>;
  metricsUsed: Record<string, number | string | null>;
  warnings: string[];
}

function gradeWithSector(
  value: number | null | undefined,
  stats: { mean: number; std: number; lowerIsBetter?: boolean },
  absolute: { excellent: number; poor: number; lowerIsBetter?: boolean }
): number | null {
  return gradeMetric(value, {
    lowerIsBetter: stats.lowerIsBetter ?? absolute.lowerIsBetter,
    excellent: absolute.excellent,
    poor: absolute.poor,
    sectorMean: stats.mean,
    sectorStd: stats.std,
  });
}

/**
 * intrinsic_value_discount — how cheap vs sector / absolute multiples.
 * Cheaper = higher score.
 */
function scoreIntrinsicDiscount(
  f: Fundamentals,
  sector: ReturnType<typeof getSectorBenchmarks>
): { score: number; note: string } {
  const pe = gradeWithSector(f.trailingPE ?? f.forwardPE, sector.trailingPE, {
    excellent: 12,
    poor: 40,
    lowerIsBetter: true,
  });
  const peg = gradeWithSector(f.pegRatio, sector.pegRatio, {
    excellent: 0.8,
    poor: 3.0,
    lowerIsBetter: true,
  });
  const evEbitda = gradeWithSector(f.enterpriseToEbitda, sector.enterpriseToEbitda, {
    excellent: 8,
    poor: 25,
    lowerIsBetter: true,
  });
  const pb = gradeWithSector(f.priceToBook, sector.priceToBook, {
    excellent: 1.0,
    poor: 8.0,
    lowerIsBetter: true,
  });

  // Analyst upside as soft signal: target vs price
  let upsideScore: number | null = null;
  if (f.targetMeanPrice != null && f.regularMarketPrice != null && f.regularMarketPrice > 0) {
    const upside = (f.targetMeanPrice - f.regularMarketPrice) / f.regularMarketPrice;
    upsideScore = linearMap(upside, -0.2, 0.4);
  }

  const composite = weightedAvg([
    { value: pe, weight: 0.35 },
    { value: peg, weight: 0.25 },
    { value: evEbitda, weight: 0.2 },
    { value: pb, weight: 0.1 },
    { value: upsideScore, weight: 0.1 },
  ]);

  const score = round1(clamp(composite ?? 5, 0, 10));
  const note = [
    `PE ${fmtNum(f.trailingPE ?? f.forwardPE)}`,
    `PEG ${fmtNum(f.pegRatio)}`,
    `EV/EBITDA ${fmtNum(f.enterpriseToEbitda)}`,
    `P/B ${fmtNum(f.priceToBook)}`,
    f.targetMeanPrice != null && f.regularMarketPrice != null
      ? `target $${fmtNum(f.targetMeanPrice)} vs $${fmtNum(f.regularMarketPrice)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/**
 * margin_of_safety — balance sheet + FCF cushion.
 */
function scoreMarginOfSafety(
  f: Fundamentals,
  sector: ReturnType<typeof getSectorBenchmarks>
): { score: number; note: string } {
  const fcf = gradeWithSector(f.fcfYield, sector.fcfYield, {
    excellent: 0.08,
    poor: 0.0,
  });

  // Net cash / mcap: positive cash is good
  const netCash = gradeMetric(f.netCashToMcap, {
    excellent: 0.15,
    poor: -0.3,
  });

  // Debt/Equity: Yahoo often reports as percent-like number (e.g. 150 = 1.5x)
  const dte = gradeWithSector(f.debtToEquity, sector.debtToEquity, {
    excellent: 20,
    poor: 200,
    lowerIsBetter: true,
  });

  const cr = gradeWithSector(f.currentRatio, sector.currentRatio, {
    excellent: 2.0,
    poor: 0.8,
  });

  const composite = weightedAvg([
    { value: fcf, weight: 0.35 },
    { value: netCash, weight: 0.25 },
    { value: dte, weight: 0.25 },
    { value: cr, weight: 0.15 },
  ]);

  const score = round1(clamp(composite ?? 5, 0, 10));
  const note = [
    `FCF yield ${fmtPct(f.fcfYield)}`,
    `net cash/mcap ${fmtPct(f.netCashToMcap)}`,
    `D/E ${fmtNum(f.debtToEquity, 1)}`,
    `current ratio ${fmtNum(f.currentRatio)}`,
  ].join(" · ");

  return { score, note };
}

/**
 * catalyst_clarity — growth acceleration + analyst coverage as proxy.
 */
function scoreCatalyst(
  f: Fundamentals,
  sector: ReturnType<typeof getSectorBenchmarks>
): { score: number; note: string } {
  const revG = gradeWithSector(f.revenueGrowth, sector.revenueGrowth, {
    excellent: 0.25,
    poor: -0.05,
  });
  const earnG = gradeWithSector(
    f.earningsGrowth ?? f.earningsQuarterlyGrowth,
    sector.earningsGrowth,
    { excellent: 0.3, poor: -0.1 }
  );

  // Analyst mean: 1=Strong Buy … 5=Sell → invert
  let analystScore: number | null = null;
  if (f.recommendationMean != null) {
    analystScore = inverseLinearLocal(f.recommendationMean, 1.0, 4.0);
  }

  // Coverage depth soft bonus
  let coverageScore: number | null = null;
  if (f.numberOfAnalystOpinions != null) {
    coverageScore = linearMap(f.numberOfAnalystOpinions, 0, 30);
  }

  const composite = weightedAvg([
    { value: revG, weight: 0.35 },
    { value: earnG, weight: 0.35 },
    { value: analystScore, weight: 0.2 },
    { value: coverageScore, weight: 0.1 },
  ]);

  const score = round1(clamp(composite ?? 5, 0, 10));
  const note = [
    `rev growth ${fmtPct(f.revenueGrowth)}`,
    `EPS growth ${fmtPct(f.earningsGrowth ?? f.earningsQuarterlyGrowth)}`,
    f.recommendationMean != null
      ? `analyst mean ${fmtNum(f.recommendationMean)} (${f.numberOfAnalystOpinions ?? "?"} ops)`
      : "analyst n/a",
  ].join(" · ");

  return { score, note };
}

function inverseLinearLocal(value: number, excellent: number, poor: number): number {
  // lower is better
  return linearMap(value, excellent, poor, 10, 0);
}

/**
 * quality_moat — profitability durability.
 */
function scoreQuality(
  f: Fundamentals,
  sector: ReturnType<typeof getSectorBenchmarks>
): { score: number; note: string } {
  const roe = gradeWithSector(f.returnOnEquity, sector.returnOnEquity, {
    excellent: 0.25,
    poor: 0.05,
  });
  const npm = gradeWithSector(f.profitMargins, sector.profitMargins, {
    excellent: 0.2,
    poor: 0.02,
  });
  const opm = gradeWithSector(f.operatingMargins, sector.operatingMargins, {
    excellent: 0.25,
    poor: 0.05,
  });
  const gm = gradeWithSector(f.grossMargins, sector.grossMargins, {
    excellent: 0.6,
    poor: 0.2,
  });

  const composite = weightedAvg([
    { value: roe, weight: 0.35 },
    { value: npm, weight: 0.25 },
    { value: opm, weight: 0.25 },
    { value: gm, weight: 0.15 },
  ]);

  const score = round1(clamp(composite ?? 5, 0, 10));
  const note = [
    `ROE ${fmtPct(f.returnOnEquity)}`,
    `NPM ${fmtPct(f.profitMargins)}`,
    `OPM ${fmtPct(f.operatingMargins)}`,
    `GM ${fmtPct(f.grossMargins)}`,
  ].join(" · ");

  return { score, note };
}

/**
 * sentiment_contrarian — prefer beaten-down quality (high when price weak but fundamentals ok).
 */
function scoreSentiment(f: Fundamentals): { score: number; note: string } {
  // Position in 52w range: lower position → higher contrarian score
  let rangeScore: number | null = null;
  if (
    f.regularMarketPrice != null &&
    f.fiftyTwoWeekHigh != null &&
    f.fiftyTwoWeekLow != null &&
    f.fiftyTwoWeekHigh > f.fiftyTwoWeekLow
  ) {
    const pos =
      (f.regularMarketPrice - f.fiftyTwoWeekLow) /
      (f.fiftyTwoWeekHigh - f.fiftyTwoWeekLow);
    // Near lows = high contrarian (bullish), near highs = low
    rangeScore = linearMap(pos, 0.15, 0.95, 10, 2);
  }

  // Short interest: higher short ratio can be contrarian bullish (mild)
  let shortScore: number | null = null;
  if (f.shortRatio != null) {
    shortScore = linearMap(f.shortRatio, 1, 8);
  }

  // Soften with quality: if ROE is terrible, don't reward cheapness alone
  let qualityGate = 1;
  if (f.returnOnEquity != null && f.returnOnEquity < 0) qualityGate = 0.6;
  else if (f.profitMargins != null && f.profitMargins < 0) qualityGate = 0.7;

  const base = avg([rangeScore, shortScore]) ?? 5;
  const score = round1(clamp(base * qualityGate, 0, 10));

  const note = [
    f.fiftyTwoWeekLow != null && f.fiftyTwoWeekHigh != null
      ? `52w $${fmtNum(f.fiftyTwoWeekLow)}–$${fmtNum(f.fiftyTwoWeekHigh)}`
      : "52w n/a",
    `price $${fmtNum(f.regularMarketPrice)}`,
    f.shortRatio != null ? `short ratio ${fmtNum(f.shortRatio)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

export function mapValuationFactors(f: Fundamentals): ValuationMapperResult {
  const sector = getSectorBenchmarks(f.sector);
  const warnings: string[] = [];

  if (f.trailingPE == null && f.forwardPE == null) {
    warnings.push("Missing PE — discount score partially estimated");
  }
  if (f.returnOnEquity == null && f.profitMargins == null) {
    warnings.push("Missing profitability metrics — quality score defaults mid");
  }

  const discount = scoreIntrinsicDiscount(f, sector);
  const safety = scoreMarginOfSafety(f, sector);
  const catalyst = scoreCatalyst(f, sector);
  const quality = scoreQuality(f, sector);
  const sentiment = scoreSentiment(f);

  const factorScores: Record<string, FactorScore> = {
    intrinsic_value_discount: { value: discount.score, note: discount.note },
    margin_of_safety: { value: safety.score, note: safety.note },
    catalyst_clarity: { value: catalyst.score, note: catalyst.note },
    quality_moat: { value: quality.score, note: quality.note },
    sentiment_contrarian: { value: sentiment.score, note: sentiment.note },
  };

  return {
    factorScores,
    metricsUsed: {
      sector: f.sector,
      marketCap: f.marketCap != null ? fmtLarge(f.marketCap) : null,
      trailingPE: f.trailingPE,
      forwardPE: f.forwardPE,
      pegRatio: f.pegRatio,
      enterpriseToEbitda: f.enterpriseToEbitda,
      priceToBook: f.priceToBook,
      fcfYield: f.fcfYield,
      returnOnEquity: f.returnOnEquity,
      profitMargins: f.profitMargins,
      revenueGrowth: f.revenueGrowth,
      debtToEquity: f.debtToEquity,
      recommendationMean: f.recommendationMean,
    },
    warnings,
  };
}
