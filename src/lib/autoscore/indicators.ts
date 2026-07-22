/**
 * Technical indicators for Trend auto-scoring.
 * Inspired by Minervini Trend Template + RyanJHamby/stock-screener phase analysis.
 */

import type { OhlcvBar } from "@/lib/marketdata/yahoo";
import { clamp, linearMap, round1 } from "./scoring-utils";

export type TrendPhase = 1 | 2 | 3 | 4;

export interface TrendIndicators {
  price: number;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  sma200Slope20d: number | null; // % change of SMA200 over ~1 month
  rsi14: number | null;
  /** 63-trading-day return of the stock. */
  return63d: number | null;
  /** 63-trading-day return of SPY (if provided). */
  spyReturn63d: number | null;
  /** Relative strength score 0–10 vs SPY. */
  relativeStrengthScore: number | null;
  /** Volume ratio: recent 5d avg / 50d avg. */
  volumeRatio: number | null;
  /** Position in 52-week range: 0 = low, 1 = high. */
  week52Position: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** Distance above 52w low as fraction (e.g. 0.3 = +30%). */
  pctAbove52wLow: number | null;
  /** Distance below 52w high as fraction (e.g. 0.1 = −10%). */
  pctBelow52wHigh: number | null;
  /** Minervini 8-criteria pass count (0–8). */
  minerviniPassCount: number;
  minerviniDetails: string[];
  phase: TrendPhase;
  phaseName: string;
  phaseConfidence: number;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function smaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i + 1 - period; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

/** Wilder RSI. */
export function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function periodReturn(closes: number[], lookback: number): number | null {
  if (closes.length <= lookback) return null;
  const prev = closes[closes.length - 1 - lookback];
  const cur = closes[closes.length - 1];
  if (prev <= 0) return null;
  return (cur - prev) / prev;
}

/**
 * Relative strength score vs benchmark.
 * RS slope proxy = stockReturn - spyReturn over 63d, mapped to 0–10.
 * +30pp outperformance → 10, −30pp → 0.
 */
export function relativeStrengthScore(
  stockReturn: number | null,
  spyReturn: number | null
): number | null {
  if (stockReturn == null || spyReturn == null) return null;
  const excess = stockReturn - spyReturn;
  return linearMap(excess, -0.3, 0.3);
}

/** Classify Weinstein/Minervini-style phase from SMA structure. */
export function classifyPhase(input: {
  price: number;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  sma200Slope20d: number | null;
}): { phase: TrendPhase; name: string; confidence: number } {
  const { price, sma50, sma150, sma200, sma200Slope20d } = input;
  if (sma50 == null || sma200 == null) {
    return { phase: 1, name: "Base Building (insufficient data)", confidence: 30 };
  }

  const above50 = price > sma50;
  const above200 = price > sma200;
  const sma50Above200 = sma50 > sma200;
  const slopeUp = (sma200Slope20d ?? 0) > 0.01; // >1% over ~20d of SMA
  const slopeDown = (sma200Slope20d ?? 0) < -0.01;
  const cascade =
    sma150 != null && sma50 > sma150 && sma150 > sma200 && price > sma50;

  // Phase 2: confirmed uptrend
  if (above50 && above200 && sma50Above200 && (slopeUp || cascade)) {
    const conf = cascade && slopeUp ? 90 : cascade || slopeUp ? 75 : 65;
    return { phase: 2, name: "Uptrend (Phase 2)", confidence: conf };
  }

  // Phase 4: downtrend
  if (!above50 && !above200 && !sma50Above200 && (slopeDown || price < sma200)) {
    return { phase: 4, name: "Downtrend (Phase 4)", confidence: slopeDown ? 85 : 70 };
  }

  // Phase 3: distribution / topping
  if (above200 && (!above50 || !sma50Above200 || slopeDown)) {
    return { phase: 3, name: "Distribution (Phase 3)", confidence: 60 };
  }

  // Phase 1: base
  return { phase: 1, name: "Base Building (Phase 1)", confidence: 55 };
}

/** Evaluate Minervini's 8 Trend Template criteria. */
export function evaluateMinervini(input: {
  price: number;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  sma200Slope20d: number | null;
  pctAbove52wLow: number | null;
  pctBelow52wHigh: number | null;
  relativeStrengthScore: number | null;
}): { passCount: number; details: string[] } {
  const details: string[] = [];
  let pass = 0;
  const {
    price,
    sma50,
    sma150,
    sma200,
    sma200Slope20d,
    pctAbove52wLow,
    pctBelow52wHigh,
    relativeStrengthScore: rs,
  } = input;

  // 1. Price > 150 SMA AND 200 SMA
  if (sma150 != null && sma200 != null && price > sma150 && price > sma200) {
    pass++;
    details.push("✓ Price > 150 & 200 SMA");
  } else {
    details.push("✗ Price not above both 150 & 200 SMA");
  }

  // 2. 150 SMA > 200 SMA
  if (sma150 != null && sma200 != null && sma150 > sma200) {
    pass++;
    details.push("✓ 150 SMA > 200 SMA");
  } else {
    details.push("✗ 150 SMA not above 200 SMA");
  }

  // 3. 200 SMA trending up ≥ 1 month (~20 trading days)
  if (sma200Slope20d != null && sma200Slope20d > 0) {
    pass++;
    details.push(`✓ 200 SMA rising (${(sma200Slope20d * 100).toFixed(1)}%)`);
  } else {
    details.push("✗ 200 SMA not rising");
  }

  // 4. 50 > 150 > 200 cascade
  if (sma50 != null && sma150 != null && sma200 != null && sma50 > sma150 && sma150 > sma200) {
    pass++;
    details.push("✓ 50 > 150 > 200 SMA cascade");
  } else {
    details.push("✗ SMA cascade not aligned");
  }

  // 5. Price > 50 SMA
  if (sma50 != null && price > sma50) {
    pass++;
    details.push("✓ Price > 50 SMA");
  } else {
    details.push("✗ Price below 50 SMA");
  }

  // 6. Price ≥ 30% above 52-week low
  if (pctAbove52wLow != null && pctAbove52wLow >= 0.3) {
    pass++;
    details.push(`✓ ≥30% above 52w low (${(pctAbove52wLow * 100).toFixed(0)}%)`);
  } else {
    details.push(
      `✗ Not ≥30% above 52w low (${pctAbove52wLow != null ? (pctAbove52wLow * 100).toFixed(0) + "%" : "n/a"})`
    );
  }

  // 7. Price within 25% of 52-week high
  if (pctBelow52wHigh != null && pctBelow52wHigh <= 0.25) {
    pass++;
    details.push(
      `✓ Within 25% of 52w high (−${(pctBelow52wHigh * 100).toFixed(0)}%)`
    );
  } else {
    details.push(
      `✗ Extended from 52w high (${pctBelow52wHigh != null ? "−" + (pctBelow52wHigh * 100).toFixed(0) + "%" : "n/a"})`
    );
  }

  // 8. RS score ≥ 7 (proxy for RS ≥ 70)
  if (rs != null && rs >= 7) {
    pass++;
    details.push(`✓ Relative strength strong (${rs.toFixed(1)}/10)`);
  } else {
    details.push(
      `✗ Relative strength weak (${rs != null ? rs.toFixed(1) + "/10" : "n/a"})`
    );
  }

  return { passCount: pass, details };
}

/**
 * Compute full trend indicator bundle from OHLCV bars.
 * @param bars Asset daily bars (oldest → newest), ideally ≥ 200 days.
 * @param spyBars Optional SPY bars for relative strength.
 */
export function computeTrendIndicators(
  bars: OhlcvBar[],
  spyBars?: OhlcvBar[]
): TrendIndicators {
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const price = closes[closes.length - 1] ?? 0;

  const sma50 = sma(closes, 50);
  const sma150 = sma(closes, 150);
  const sma200 = sma(closes, 200);

  // SMA200 slope over last 20 sessions
  let sma200Slope20d: number | null = null;
  if (closes.length >= 220) {
    const series = smaSeries(closes, 200);
    const cur = series[series.length - 1];
    const prev = series[series.length - 21];
    if (cur != null && prev != null && prev > 0) {
      sma200Slope20d = (cur - prev) / prev;
    }
  } else if (sma200 != null && closes.length >= 200) {
    // Fallback: compare current SMA200 vs price 20d ago approximation
    const older = sma(closes.slice(0, closes.length - 20), 200);
    if (older != null && older > 0) {
      sma200Slope20d = (sma200 - older) / older;
    }
  }

  const rsi14 = computeRsi(closes, 14);
  const return63d = periodReturn(closes, 63);

  let spyReturn63d: number | null = null;
  if (spyBars && spyBars.length > 63) {
    const spyCloses = spyBars.map((b) => b.close);
    spyReturn63d = periodReturn(spyCloses, 63);
  }

  const rsScore = relativeStrengthScore(return63d, spyReturn63d);

  // Volume ratio
  let volumeRatio: number | null = null;
  if (volumes.length >= 50) {
    const recent = volumes.slice(-5);
    const base = volumes.slice(-50);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgBase = base.reduce((a, b) => a + b, 0) / base.length;
    if (avgBase > 0) volumeRatio = avgRecent / avgBase;
  }

  // 52-week range from available bars (use up to 252 trading days)
  const window = closes.slice(-252);
  const week52High = window.length ? Math.max(...window) : null;
  const week52Low = window.length ? Math.min(...window) : null;
  let week52Position: number | null = null;
  let pctAbove52wLow: number | null = null;
  let pctBelow52wHigh: number | null = null;
  if (week52High != null && week52Low != null && week52High > week52Low) {
    week52Position = (price - week52Low) / (week52High - week52Low);
    pctAbove52wLow = (price - week52Low) / week52Low;
    pctBelow52wHigh = (week52High - price) / week52High;
  }

  const { phase, name, confidence } = classifyPhase({
    price,
    sma50,
    sma150,
    sma200,
    sma200Slope20d,
  });

  const minervini = evaluateMinervini({
    price,
    sma50,
    sma150,
    sma200,
    sma200Slope20d,
    pctAbove52wLow,
    pctBelow52wHigh,
    relativeStrengthScore: rsScore,
  });

  return {
    price,
    sma50,
    sma150,
    sma200,
    sma200Slope20d,
    rsi14,
    return63d,
    spyReturn63d,
    relativeStrengthScore: rsScore,
    volumeRatio,
    week52Position,
    week52High,
    week52Low,
    pctAbove52wLow,
    pctBelow52wHigh,
    minerviniPassCount: minervini.passCount,
    minerviniDetails: minervini.details,
    phase,
    phaseName: name,
    phaseConfidence: confidence,
  };
}

/** Convenience: clamp helper re-export for mappers. */
export { clamp, round1, linearMap };
