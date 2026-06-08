import { NextResponse } from "next/server";
import { getAssetMetaAndPrice } from "@/lib/marketdata/yahoo";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticker = (body.ticker as string)?.trim().toUpperCase();
    if (!ticker) {
      return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
    }

    const result = await getAssetMetaAndPrice(ticker);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
