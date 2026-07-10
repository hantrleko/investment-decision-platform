"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { useToast } from "@/components/layout/toast-provider";

interface BacktestResult {
  kind: string;
  bars: number;
  startDate: string | null;
  endDate: string | null;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRate: number;
  avgTradeReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  trades: Array<{ returnPct: number }>;
  equityCurve: Array<{ equity: number }>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function BacktestRunner({ tickers }: { tickers: string[] }) {
  const toast = useToast();
  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [manualTicker, setManualTicker] = useState("");
  const [kind, setKind] = useState("sma_crossover");
  const [range, setRange] = useState("1y");
  const [fastWindow, setFastWindow] = useState("20");
  const [slowWindow, setSlowWindow] = useState("50");
  const [lookback, setLookback] = useState("20");
  const [momentumThreshold, setMomentumThreshold] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const effectiveTicker = (manualTicker || ticker).trim().toUpperCase();
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: effectiveTicker,
          kind,
          range,
          fastWindow: Number(fastWindow),
          slowWindow: Number(slowWindow),
          lookback: Number(lookback),
          momentumThreshold: Number(momentumThreshold),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Backtest failed");
        toast.error(data.error ?? "Backtest failed");
        return;
      }
      setResult(data);
      toast.success(
        `Backtest complete: ${data.totalReturnPct?.toFixed(1)}% over ${data.bars} bars`
      );
    } catch {
      setError("Network error running backtest");
      toast.error("Network error running backtest");
    } finally {
      setLoading(false);
    }
  }

  const outperformed =
    result != null && result.totalReturnPct > result.buyHoldReturnPct;

  return (
    <div className="space-y-6">
      <form
        onSubmit={run}
        className="grid gap-4 rounded-lg border p-4 md:grid-cols-4 md:items-end"
      >
        <div className="space-y-1">
          <Label>Asset</Label>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {tickers.length === 0 && <option value="">No assets</option>}
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bt-manual">Or ticker</Label>
          <Input
            id="bt-manual"
            value={manualTicker}
            onChange={(e) => setManualTicker(e.target.value)}
            placeholder="e.g. TSLA"
          />
        </div>
        <div className="space-y-1">
          <Label>Signal</Label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="sma_crossover">SMA Crossover</option>
            <option value="momentum">Momentum</option>
            <option value="buy_hold">Buy &amp; Hold</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Range</Label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="6mo">6 months</option>
            <option value="1y">1 year</option>
            <option value="2y">2 years</option>
            <option value="5y">5 years</option>
            <option value="max">Max</option>
          </select>
        </div>

        {kind === "sma_crossover" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="bt-fast">Fast window</Label>
              <Input
                id="bt-fast"
                type="number"
                value={fastWindow}
                onChange={(e) => setFastWindow(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bt-slow">Slow window</Label>
              <Input
                id="bt-slow"
                type="number"
                value={slowWindow}
                onChange={(e) => setSlowWindow(e.target.value)}
              />
            </div>
          </>
        )}
        {kind === "momentum" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="bt-lb">Lookback</Label>
              <Input
                id="bt-lb"
                type="number"
                value={lookback}
                onChange={(e) => setLookback(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bt-mt">Threshold %</Label>
              <Input
                id="bt-mt"
                type="number"
                step="any"
                value={momentumThreshold}
                onChange={(e) => setMomentumThreshold(e.target.value)}
              />
            </div>
          </>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "Running…" : "Run backtest"}
        </Button>
        {error && <p className="text-sm text-red-500 md:col-span-4">{error}</p>}
      </form>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              Result — {result.kind} · {result.bars} bars
              {result.startDate && result.endDate && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {result.startDate.slice(0, 10)} → {result.endDate.slice(0, 10)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Metric
                label="Strategy Return"
                value={`${result.totalReturnPct.toFixed(2)}%`}
              />
              <Metric
                label="Buy & Hold"
                value={`${result.buyHoldReturnPct.toFixed(2)}%`}
              />
              <Metric label="Win Rate" value={`${result.winRate}%`} />
              <Metric
                label="Avg Trade"
                value={`${result.avgTradeReturnPct.toFixed(2)}%`}
              />
              <Metric
                label="Max Drawdown"
                value={`${result.maxDrawdownPct.toFixed(2)}%`}
              />
              <Metric label="Sharpe" value={result.sharpe.toFixed(2)} />
            </div>

            <div
              className={`rounded-md px-3 py-2 text-sm ${
                outperformed
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {outperformed
                ? `Strategy outperformed buy & hold by ${(
                    result.totalReturnPct - result.buyHoldReturnPct
                  ).toFixed(2)} pts across ${result.trades.length} trade(s).`
                : `Strategy underperformed buy & hold by ${(
                    result.buyHoldReturnPct - result.totalReturnPct
                  ).toFixed(2)} pts. Consider different parameters.`}
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Equity Curve</div>
              <Sparkline
                points={result.equityCurve.map((p) => p.equity * 100)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
