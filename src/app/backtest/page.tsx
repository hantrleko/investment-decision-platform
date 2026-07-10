import { prisma } from "@/lib/db";
import { BacktestRunner } from "@/components/backtest/backtest-runner";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const assets = await prisma.asset.findMany({
    select: { ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backtest</h1>
        <p className="text-sm text-muted-foreground">
          Replay a price-based signal over historical daily closes to validate
          parameters before trusting a live threshold. Metrics: total return vs.
          buy &amp; hold, win rate, max drawdown, and an annualized Sharpe ratio.
        </p>
      </div>
      <BacktestRunner
        tickers={assets.map((a) => a.ticker)}
      />
    </div>
  );
}
