import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const asset = await prisma.asset.findUnique({ where: { ticker } });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const price = parseFloat(body.price);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const updated = await prisma.asset.update({
      where: { ticker },
      data: {
        lastPrice: price,
        lastPriceTs: new Date(),
        priceSource: "manual",
      },
    });

    return NextResponse.json({
      lastPrice: updated.lastPrice,
      lastPriceTs: updated.lastPriceTs?.toISOString(),
      priceSource: updated.priceSource,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
