import { describe, it, expect } from "vitest";
import {
  computeRsi,
  classifyPhase,
  evaluateMinervini,
  relativeStrengthScore,
  computeTrendIndicators,
} from "@/lib/autoscore/indicators";
import type { OhlcvBar } from "@/lib/marketdata/yahoo";

function makeBars(
  closes: number[],
  opts?: { volume?: number }
): OhlcvBar[] {
  const volume = opts?.volume ?? 1_000_000;
  return closes.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)),
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume,
  }));
}

/** Synthetic uptrend: slow rise over n days ending near `end`. */
function risingSeries(n: number, start = 100, end = 160): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(n - 1, 1);
    out.push(start + (end - start) * t);
  }
  return out;
}

describe("computeRsi", () => {
  it("returns null with insufficient data", () => {
    expect(computeRsi([1, 2, 3], 14)).toBeNull();
  });

  it("is high on a steady uptrend", () => {
    const closes = risingSeries(40, 100, 140);
    const rsi = computeRsi(closes, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(70);
  });

  it("is low on a steady downtrend", () => {
    const closes = risingSeries(40, 140, 100);
    const rsi = computeRsi(closes, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeLessThan(30);
  });
});

describe("relativeStrengthScore", () => {
  it("maps excess return to 0–10", () => {
    expect(relativeStrengthScore(0.3, 0)).toBe(10);
    expect(relativeStrengthScore(-0.3, 0)).toBe(0);
    expect(relativeStrengthScore(0.1, 0.1)).toBe(5);
    expect(relativeStrengthScore(null, 0.1)).toBeNull();
  });
});

describe("classifyPhase", () => {
  it("detects Phase 2 uptrend", () => {
    const result = classifyPhase({
      price: 120,
      sma50: 115,
      sma150: 110,
      sma200: 100,
      sma200Slope20d: 0.02,
    });
    expect(result.phase).toBe(2);
    expect(result.name).toMatch(/Uptrend/i);
  });

  it("detects Phase 4 downtrend", () => {
    const result = classifyPhase({
      price: 80,
      sma50: 90,
      sma150: 100,
      sma200: 110,
      sma200Slope20d: -0.02,
    });
    expect(result.phase).toBe(4);
  });

  it("returns base building with missing SMAs", () => {
    const result = classifyPhase({
      price: 100,
      sma50: null,
      sma150: null,
      sma200: null,
      sma200Slope20d: null,
    });
    expect(result.phase).toBe(1);
    expect(result.confidence).toBeLessThan(50);
  });
});

describe("evaluateMinervini", () => {
  it("passes all 8 on a textbook setup", () => {
    const { passCount, details } = evaluateMinervini({
      price: 150,
      sma50: 140,
      sma150: 130,
      sma200: 120,
      sma200Slope20d: 0.03,
      pctAbove52wLow: 0.5,
      pctBelow52wHigh: 0.05,
      relativeStrengthScore: 8.5,
    });
    expect(passCount).toBe(8);
    expect(details.every((d) => d.startsWith("✓"))).toBe(true);
  });

  it("fails most criteria on a broken chart", () => {
    const { passCount } = evaluateMinervini({
      price: 80,
      sma50: 100,
      sma150: 110,
      sma200: 120,
      sma200Slope20d: -0.02,
      pctAbove52wLow: 0.05,
      pctBelow52wHigh: 0.4,
      relativeStrengthScore: 2,
    });
    expect(passCount).toBeLessThan(3);
  });
});

describe("computeTrendIndicators", () => {
  it("computes SMAs, RSI, Minervini on long rising series", () => {
    const closes = risingSeries(260, 80, 160);
    const bars = makeBars(closes);
    const spy = makeBars(risingSeries(260, 100, 120));

    const ind = computeTrendIndicators(bars, spy);

    expect(ind.price).toBeCloseTo(160, 5);
    expect(ind.sma50).not.toBeNull();
    expect(ind.sma150).not.toBeNull();
    expect(ind.sma200).not.toBeNull();
    expect(ind.sma50!).toBeGreaterThan(ind.sma150!);
    expect(ind.sma150!).toBeGreaterThan(ind.sma200!);
    expect(ind.rsi14).not.toBeNull();
    expect(ind.return63d).not.toBeNull();
    expect(ind.spyReturn63d).not.toBeNull();
    expect(ind.relativeStrengthScore).not.toBeNull();
    expect(ind.minerviniPassCount).toBeGreaterThanOrEqual(5);
    expect(ind.phase).toBe(2);
    expect(ind.week52Position).not.toBeNull();
    expect(ind.volumeRatio).not.toBeNull();
  });

  it("handles short series without throwing", () => {
    const bars = makeBars(risingSeries(30, 100, 110));
    const ind = computeTrendIndicators(bars);
    expect(ind.sma200).toBeNull();
    expect(ind.phase).toBe(1);
    expect(ind.minerviniPassCount).toBeLessThan(5);
  });
});
