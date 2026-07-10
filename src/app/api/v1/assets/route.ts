import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiToken, tokenHasScope } from "@/lib/api-tokens";

/**
 * GET /api/v1/assets — read-only list of tracked assets.
 * Auth: Authorization: Bearer eug_... token with "read" or "read:assets" scope.
 */
export async function GET(request: Request) {
  const token = await verifyApiToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Invalid or missing API token" },
      { status: 401 }
    );
  }
  if (!tokenHasScope(token, "read:assets")) {
    return NextResponse.json(
      { error: "Token lacks read:assets scope" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 500);

  const assets = await prisma.asset.findMany({
    take: limit,
    orderBy: { ticker: "asc" },
    select: {
      ticker: true,
      name: true,
      sector: true,
      assetType: true,
      exchange: true,
      lastPrice: true,
      lastPriceTs: true,
      priceSource: true,
    },
  });

  return NextResponse.json({ data: assets, count: assets.length });
}
