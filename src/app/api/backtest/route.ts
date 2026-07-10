import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { getHistoricalPrices } from "@/lib/marketdata/yahoo";
import { runBacktest, type SignalKind } from "@/lib/backtest/engine";
import { logger } from "@/lib/logger";

const VALID_KINDS: SignalKind[] = ["sma_crossover", "momentum", "buy_hold"];

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  const kind = String(body.kind ?? "sma_crossover") as SignalKind;
  const range = String(body.range ?? "1y");

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of ${VALID_KINDS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const series = await getHistoricalPrices(ticker, range);
    if (series.length < 2) {
      return NextResponse.json(
        { error: `Not enough historical data for "${ticker}"` },
        { status: 502 }
      );
    }

    const result = runBacktest(series, {
      kind,
      fastWindow: body.fastWindow ? Number(body.fastWindow) : undefined,
      slowWindow: body.slowWindow ? Number(body.slowWindow) : undefined,
      lookback: body.lookback ? Number(body.lookback) : undefined,
      momentumThreshold:
        body.momentumThreshold != null
          ? Number(body.momentumThreshold)
          : undefined,
    });

    logger.info("Backtest run", {
      ticker,
      kind,
      range,
      bars: result.bars,
      totalReturnPct: result.totalReturnPct,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backtest failed";
    logger.error("Backtest failed", { ticker, kind, error: err });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
