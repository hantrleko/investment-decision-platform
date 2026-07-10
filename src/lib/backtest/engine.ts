/**
 * Price-signal backtest engine.
 *
 * Replays a simple, explainable trading signal over a historical daily close
 * series and reports performance metrics. This validates *price-based* signal
 * parameters (e.g. moving-average crossovers, momentum) independently of the
 * qualitative framework-score strategies. Pure and deterministic → unit-testable.
 */

export interface PricePoint {
  date: Date;
  close: number;
}

export type SignalKind = "sma_crossover" | "momentum" | "buy_hold";

export interface BacktestParams {
  kind: SignalKind;
  /** Fast SMA window (sma_crossover). */
  fastWindow?: number;
  /** Slow SMA window (sma_crossover). */
  slowWindow?: number;
  /** Lookback window for momentum (momentum). */
  lookback?: number;
  /** Momentum threshold in percent to go long (momentum). */
  momentumThreshold?: number;
}

export interface Trade {
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  returnPct: number;
}

export interface BacktestResult {
  kind: SignalKind;
  params: BacktestParams;
  startDate: Date | null;
  endDate: Date | null;
  bars: number;
  trades: Trade[];
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRate: number;
  avgTradeReturnPct: number;
  maxDrawdownPct: number;
  /** Annualized Sharpe-like ratio of daily equity returns (rf=0). */
  sharpe: number;
  /** Daily equity curve (1.0 = starting capital). */
  equityCurve: Array<{ date: Date; equity: number }>;
}

function sma(values: number[], window: number, endIdx: number): number | null {
  if (endIdx + 1 < window) return null;
  let sum = 0;
  for (let i = endIdx - window + 1; i <= endIdx; i++) sum += values[i];
  return sum / window;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Compute a long/flat position series (1 = long, 0 = flat) for the signal.
 * Position at bar i is applied to the return realized between bar i and i+1.
 */
function computePositions(prices: number[], params: BacktestParams): number[] {
  const n = prices.length;
  const pos = new Array<number>(n).fill(0);

  switch (params.kind) {
    case "buy_hold": {
      pos.fill(1);
      return pos;
    }
    case "sma_crossover": {
      const fast = Math.max(1, params.fastWindow ?? 20);
      const slow = Math.max(fast + 1, params.slowWindow ?? 50);
      for (let i = 0; i < n; i++) {
        const f = sma(prices, fast, i);
        const s = sma(prices, slow, i);
        pos[i] = f != null && s != null && f > s ? 1 : 0;
      }
      return pos;
    }
    case "momentum": {
      const lb = Math.max(1, params.lookback ?? 20);
      const thr = params.momentumThreshold ?? 0;
      for (let i = 0; i < n; i++) {
        if (i < lb) {
          pos[i] = 0;
          continue;
        }
        const past = prices[i - lb];
        const mom = past === 0 ? 0 : ((prices[i] - past) / past) * 100;
        pos[i] = mom >= thr ? 1 : 0;
      }
      return pos;
    }
  }
}

export function runBacktest(
  series: PricePoint[],
  params: BacktestParams
): BacktestResult {
  const clean = series
    .filter((p) => p.close != null && !Number.isNaN(p.close))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const prices = clean.map((p) => p.close);
  const n = prices.length;

  const empty: BacktestResult = {
    kind: params.kind,
    params,
    startDate: clean[0]?.date ?? null,
    endDate: clean[n - 1]?.date ?? null,
    bars: n,
    trades: [],
    totalReturnPct: 0,
    buyHoldReturnPct: 0,
    winRate: 0,
    avgTradeReturnPct: 0,
    maxDrawdownPct: 0,
    sharpe: 0,
    equityCurve: [],
  };

  if (n < 2) return empty;

  const positions = computePositions(prices, params);

  // Simulate equity, trades, and daily returns.
  let equity = 1;
  const equityCurve: Array<{ date: Date; equity: number }> = [
    { date: clean[0].date, equity: 1 },
  ];
  const dailyReturns: number[] = [];
  const trades: Trade[] = [];

  let inPosition = false;
  let entryPrice = 0;
  let entryDate = clean[0].date;

  for (let i = 0; i < n - 1; i++) {
    const held = positions[i] === 1;
    const dayRet = held ? (prices[i + 1] - prices[i]) / prices[i] : 0;
    equity *= 1 + dayRet;
    dailyReturns.push(dayRet);
    equityCurve.push({ date: clean[i + 1].date, equity: round(equity, 6) });

    // Track discrete trades on entry/exit transitions.
    if (held && !inPosition) {
      inPosition = true;
      entryPrice = prices[i];
      entryDate = clean[i].date;
    }
    const willHoldNext = positions[i + 1] === 1;
    if (inPosition && (!willHoldNext || i === n - 2)) {
      const exitPrice = prices[i + 1];
      trades.push({
        entryDate,
        entryPrice: round(entryPrice, 4),
        exitDate: clean[i + 1].date,
        exitPrice: round(exitPrice, 4),
        returnPct: round(((exitPrice - entryPrice) / entryPrice) * 100, 4),
      });
      inPosition = false;
    }
  }

  const totalReturnPct = round((equity - 1) * 100, 4);
  const buyHoldReturnPct = round(
    ((prices[n - 1] - prices[0]) / prices[0]) * 100,
    4
  );

  const wins = trades.filter((t) => t.returnPct > 0).length;
  const winRate = trades.length ? round((wins / trades.length) * 100, 2) : 0;
  const avgTradeReturnPct = trades.length
    ? round(
        trades.reduce((s, t) => s + t.returnPct, 0) / trades.length,
        4
      )
    : 0;

  // Max drawdown from the equity curve.
  let peak = -Infinity;
  let maxDd = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = (peak - point.equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDrawdownPct = round(maxDd * 100, 4);

  // Annualized Sharpe (rf=0), 252 trading days.
  let sharpe = 0;
  if (dailyReturns.length > 1) {
    const mean =
      dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    const std = Math.sqrt(variance);
    sharpe = std === 0 ? 0 : round((mean / std) * Math.sqrt(252), 4);
  }

  return {
    kind: params.kind,
    params,
    startDate: clean[0].date,
    endDate: clean[n - 1].date,
    bars: n,
    trades,
    totalReturnPct,
    buyHoldReturnPct,
    winRate,
    avgTradeReturnPct,
    maxDrawdownPct,
    sharpe,
    equityCurve,
  };
}
