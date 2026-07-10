import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPrice } from "@/lib/marketdata/yahoo";
import { evaluateAlertsForAsset } from "@/lib/alerts/notify";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const asset = await prisma.asset.findUnique({ where: { ticker } });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const price = await getPrice(ticker);

    if (price == null) {
      return NextResponse.json({ error: "No price returned" }, { status: 502 });
    }

    const updated = await prisma.asset.update({
      where: { ticker },
      data: {
        lastPrice: price,
        lastPriceTs: new Date(),
        priceSource: "yahoo",
      },
    });

    // Fire any alerts that this fresh price satisfies.
    const triggered = await evaluateAlertsForAsset(ticker, price);

    return NextResponse.json({
      lastPrice: updated.lastPrice,
      lastPriceTs: updated.lastPriceTs?.toISOString(),
      priceSource: updated.priceSource,
      alertsTriggered: triggered.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
