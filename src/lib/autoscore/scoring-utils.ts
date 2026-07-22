/**
 * Shared scoring helpers for auto-evaluation.
 * Linear mapping + sector-relative grading (inspired by
 * faizancodes/Automated-Fundamental-Analysis).
 */

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Round to 1 decimal place (factor scores are 0–10). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Linear map from value in [inMin, inMax] → [outMin, outMax], clamped.
 * Higher input → higher output.
 */
export function linearMap(
  value: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 10
): number {
  if (inMax === inMin) return round1((outMin + outMax) / 2);
  const t = (value - inMin) / (inMax - inMin);
  const raw = outMin + t * (outMax - outMin);
  // Support inverted output ranges (used by inverseLinearMap): clamp to
  // the numeric [lo, hi] of the two endpoints, not (outMin, outMax) order.
  const lo = Math.min(outMin, outMax);
  const hi = Math.max(outMin, outMax);
  return round1(clamp(raw, lo, hi));
}

/**
 * Inverse linear map: lower input → higher output.
 * Useful for valuation multiples (cheap = good).
 */
export function inverseLinearMap(
  value: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 10
): number {
  return linearMap(value, inMin, inMax, outMax, outMin);
}

/**
 * Sector benchmark for a single metric.
 * Values are "typical good / typical bad" anchors used when we lack
 * a live peer distribution. Inspired by sector-relative grading.
 */
export interface MetricBenchmark {
  /** Lower values are better (e.g. PE, PEG, debt). */
  lowerIsBetter?: boolean;
  /**
   * Absolute fallback anchors used when sector stats are missing.
   * For lowerIsBetter: excellent = cheap side, poor = expensive side.
   * For higherIsBetter: excellent = high side, poor = low side.
   */
  excellent: number;
  poor: number;
  /**
   * Optional sector-relative mean & std-dev (Phase 2).
   * When present, score via (value - mean) / std with 3-sigma banding.
   */
  sectorMean?: number;
  sectorStd?: number;
}

/**
 * Grade a metric to 0–10.
 *
 * Priority:
 *  1. Sector mean/std  →  z-score mapped through ±1.5σ window (Faizan-style)
 *  2. Absolute excellent/poor anchors → linear / inverse-linear map
 */
export function gradeMetric(
  value: number | null | undefined,
  bench: MetricBenchmark
): number | null {
  if (value == null || Number.isNaN(value)) return null;

  if (
    bench.sectorMean != null &&
    bench.sectorStd != null &&
    bench.sectorStd > 0
  ) {
    const z = (value - bench.sectorMean) / bench.sectorStd;
    // Map z in [-1.5, +1.5] → [0, 10] (or inverted)
    const score = bench.lowerIsBetter
      ? inverseLinearMap(z, -1.5, 1.5)
      : linearMap(z, -1.5, 1.5);
    return score;
  }

  if (bench.lowerIsBetter) {
    return inverseLinearMap(value, bench.excellent, bench.poor);
  }
  return linearMap(value, bench.poor, bench.excellent);
}

/** Average of non-null numbers; returns null if empty. */
export function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Weighted average; skips nulls and renormalizes weights. */
export function weightedAvg(
  parts: Array<{ value: number | null; weight: number }>
): number | null {
  let sum = 0;
  let wSum = 0;
  for (const p of parts) {
    if (p.value == null || Number.isNaN(p.value)) continue;
    sum += p.value * p.weight;
    wSum += p.weight;
  }
  if (wSum === 0) return null;
  return sum / wSum;
}

/** Format a ratio/percent for display in factor notes. */
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  return v.toFixed(digits);
}

export function fmtLarge(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v.toFixed(0);
}
