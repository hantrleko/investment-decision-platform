/**
 * Lightweight Macro framework auto-scoring.
 * Uses market regime (SPY phase) + sector rate sensitivity + beta.
 * Intentionally conservative — defaults toward neutral (5) when uncertain.
 */

import type { Fundamentals } from "@/lib/marketdata/yahoo";
import type { FactorScore } from "@/lib/scoring/compute";
import type { TrendIndicators } from "./indicators";
import {
  RATE_BENEFICIARY_SECTORS,
  RATE_SENSITIVE_SECTORS,
  normalizeSector,
} from "./sector-stats";
import { clamp, fmtNum, linearMap, round1 } from "./scoring-utils";

export interface MacroMapperResult {
  factorScores: Record<string, FactorScore>;
  metricsUsed: Record<string, number | string | null>;
  warnings: string[];
}

/**
 * regime_alignment — does current market phase favor this asset's trend?
 */
function scoreRegime(
  assetPhase: TrendIndicators["phase"],
  spyPhase: TrendIndicators["phase"] | null,
  assetRs: number | null
): { score: number; note: string } {
  // Market healthy (SPY phase 1/2) + asset phase 2 = high
  let base = 5;
  if (spyPhase == null) {
    base = assetPhase === 2 ? 6.5 : assetPhase === 4 ? 3.5 : 5;
  } else if (spyPhase === 2) {
    base = assetPhase === 2 ? 8.5 : assetPhase === 1 ? 6.5 : assetPhase === 3 ? 4 : 2.5;
  } else if (spyPhase === 1) {
    base = assetPhase === 2 ? 7 : assetPhase === 1 ? 6 : 4;
  } else if (spyPhase === 3) {
    base = assetPhase === 2 ? 5 : assetPhase === 4 ? 3 : 4;
  } else {
    // SPY phase 4 — risk-off
    base = assetPhase === 4 ? 2 : assetPhase === 2 ? 4 : 3;
  }

  // Nudge by RS
  if (assetRs != null) {
    base = base * 0.8 + assetRs * 0.2;
  }

  const score = round1(clamp(base, 0, 10));
  const note = [
    `asset phase ${assetPhase}`,
    spyPhase != null ? `SPY phase ${spyPhase}` : "SPY phase n/a",
    assetRs != null ? `RS ${fmtNum(assetRs, 1)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/**
 * rate_sensitivity — how does the rate environment affect this asset?
 * Without live rates, we score "resilience to higher rates":
 * beneficiaries high, sensitive sectors lower, beta amplifies.
 */
function scoreRateSensitivity(f: Fundamentals): { score: number; note: string } {
  const sector = normalizeSector(f.sector);
  let base = 5;

  if (RATE_BENEFICIARY_SECTORS.has(sector) || RATE_BENEFICIARY_SECTORS.has(f.sector ?? "")) {
    base = 7.5;
  } else if (RATE_SENSITIVE_SECTORS.has(sector) || RATE_SENSITIVE_SECTORS.has(f.sector ?? "")) {
    base = 3.5;
  }

  // High beta in sensitive sector = worse; low beta = slightly better
  if (f.beta != null) {
    if (base < 5) {
      // sensitive: higher beta hurts more
      base = base - linearMap(f.beta, 0.6, 1.8, 0, 1.5);
    } else if (base > 5) {
      // beneficiary: moderate beta ok
      base = base + (f.beta > 1.2 ? -0.3 : 0.2);
    } else {
      base = base + linearMap(f.beta, 1.5, 0.7, -1, 1);
    }
  }

  // High debt makes rate hikes worse
  if (f.debtToEquity != null && f.debtToEquity > 100) {
    base -= linearMap(f.debtToEquity, 100, 250, 0, 1.5);
  }

  const score = round1(clamp(base, 0, 10));
  const note = [
    `sector ${f.sector ?? "unknown"}`,
    f.beta != null ? `beta ${fmtNum(f.beta)}` : "beta n/a",
    f.debtToEquity != null ? `D/E ${fmtNum(f.debtToEquity, 1)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/**
 * fiscal_tailwind — proxy via sector growth + earnings growth (no live fiscal data).
 * Neutral-biased.
 */
function scoreFiscal(f: Fundamentals): { score: number; note: string } {
  // Sectors often with fiscal support: Defense/Industrials, Healthcare, Energy (policy-dependent)
  const sector = (f.sector ?? "").toLowerCase();
  let base = 5;
  if (sector.includes("industrials") || sector.includes("healthcare") || sector.includes("energy")) {
    base = 6;
  } else if (sector.includes("technology") || sector.includes("communication")) {
    base = 5.5;
  } else if (sector.includes("real estate") || sector.includes("utilities")) {
    base = 4.5;
  }

  if (f.revenueGrowth != null) {
    base = base * 0.7 + linearMap(f.revenueGrowth, -0.05, 0.2) * 0.3;
  }

  const score = round1(clamp(base, 0, 10));
  const note = [
    `sector ${f.sector ?? "unknown"} (static fiscal proxy)`,
    f.revenueGrowth != null
      ? `rev growth ${fmtNum(f.revenueGrowth * 100, 1)}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

/**
 * geopolitical_risk (inverse) — higher = less risk.
 * Proxy: low beta, domestic-leaning sectors, strong balance sheet.
 */
function scoreGeopolitical(f: Fundamentals): { score: number; note: string } {
  let base = 5.5; // mild positive default

  const sector = (f.sector ?? "").toLowerCase();
  if (
    sector.includes("utilities") ||
    sector.includes("consumer defensive") ||
    sector.includes("consumer staples") ||
    sector.includes("healthcare")
  ) {
    base = 7;
  } else if (
    sector.includes("energy") ||
    sector.includes("basic materials") ||
    sector.includes("industrials")
  ) {
    base = 4.5;
  } else if (sector.includes("technology") || sector.includes("communication")) {
    base = 5;
  }

  // Lower beta → safer
  if (f.beta != null) {
    base = base * 0.7 + linearMap(f.beta, 1.6, 0.6) * 0.3;
  }

  // Strong cash position reduces risk
  if (f.netCashToMcap != null && f.netCashToMcap > 0.05) {
    base += 0.5;
  }
  if (f.debtToEquity != null && f.debtToEquity > 150) {
    base -= 0.5;
  }

  const score = round1(clamp(base, 0, 10));
  const note = [
    `sector ${f.sector ?? "unknown"} (geo proxy)`,
    f.beta != null ? `beta ${fmtNum(f.beta)}` : null,
    f.netCashToMcap != null
      ? `net cash/mcap ${fmtNum(f.netCashToMcap * 100, 1)}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { score, note };
}

export function mapMacroFactors(
  f: Fundamentals,
  assetTrend: TrendIndicators,
  spyTrend: TrendIndicators | null
): MacroMapperResult {
  const warnings: string[] = [
    "Macro scores use lightweight proxies (no live rates/fiscal feeds) — treat as directional",
  ];

  const regime = scoreRegime(
    assetTrend.phase,
    spyTrend?.phase ?? null,
    assetTrend.relativeStrengthScore
  );
  const rates = scoreRateSensitivity(f);
  const fiscal = scoreFiscal(f);
  const geo = scoreGeopolitical(f);

  return {
    factorScores: {
      regime_alignment: { value: regime.score, note: regime.note },
      rate_sensitivity: { value: rates.score, note: rates.note },
      fiscal_tailwind: { value: fiscal.score, note: fiscal.note },
      geopolitical_risk: { value: geo.score, note: geo.note },
    },
    metricsUsed: {
      assetPhase: assetTrend.phaseName,
      spyPhase: spyTrend?.phaseName ?? null,
      sector: f.sector,
      beta: f.beta,
      debtToEquity: f.debtToEquity,
    },
    warnings,
  };
}
