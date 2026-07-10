import { describe, it, expect } from "vitest";
import { runBacktest, type PricePoint } from "@/lib/backtest/engine";

function series(closes: number[]): PricePoint[] {
  const start = new Date("2024-01-01").getTime();
  return closes.map((close, i) => ({
    date: new Date(start + i * 86400_000),
    close,
  }));
}

describe("backtest engine", () => {
  it("returns empty result for insufficient data", () => {
    const r = runBacktest(series([100]), { kind: "buy_hold" });
    expect(r.bars).toBe(1);
    expect(r.trades).toHaveLength(0);
    expect(r.totalReturnPct).toBe(0);
  });

  it("buy_hold total return equals buy-hold return", () => {
    const r = runBacktest(series([100, 110, 121]), { kind: "buy_hold" });
    expect(r.totalReturnPct).toBeCloseTo(21, 1);
    expect(r.buyHoldReturnPct).toBeCloseTo(21, 1);
    expect(r.trades.length).toBe(1);
  });

  it("sma_crossover stays flat when fast never exceeds slow (declining series)", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 - i);
    const r = runBacktest(closes.map((c, i) => ({ date: new Date(2024, 0, i + 1), close: c })), {
      kind: "sma_crossover",
      fastWindow: 5,
      slowWindow: 20,
    });
    // Declining market → fast below slow → no long exposure → ~0% return
    expect(r.totalReturnPct).toBeCloseTo(0, 5);
    expect(r.trades.length).toBe(0);
  });

  it("momentum goes long in a strong uptrend and captures gains", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 * 1.02 ** i);
    const r = runBacktest(closes.map((c, i) => ({ date: new Date(2024, 0, i + 1), close: c })), {
      kind: "momentum",
      lookback: 5,
      momentumThreshold: 0,
    });
    expect(r.totalReturnPct).toBeGreaterThan(0);
    expect(r.trades.length).toBeGreaterThanOrEqual(1);
  });

  it("computes max drawdown as a non-negative percentage", () => {
    const r = runBacktest(series([100, 120, 90, 110, 80]), { kind: "buy_hold" });
    expect(r.maxDrawdownPct).toBeGreaterThan(0);
  });

  it("win rate reflects profitable trades", () => {
    const r = runBacktest(series([100, 110, 121]), { kind: "buy_hold" });
    expect(r.winRate).toBe(100);
  });

  it("filters NaN/null closes and sorts by date", () => {
    const pts: PricePoint[] = [
      { date: new Date("2024-01-03"), close: 120 },
      { date: new Date("2024-01-01"), close: 100 },
      // @ts-expect-error deliberately bad
      { date: new Date("2024-01-02"), close: null },
    ];
    const r = runBacktest(pts, { kind: "buy_hold" });
    expect(r.bars).toBe(2);
    expect(r.startDate?.toISOString().startsWith("2024-01-01")).toBe(true);
  });
});
