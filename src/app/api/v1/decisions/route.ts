import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiToken, tokenHasScope } from "@/lib/api-tokens";

/**
 * GET /api/v1/decisions — read-only list of investment decisions.
 * Auth: Authorization: Bearer eug_... token with "read" or "read:decisions".
 */
export async function GET(request: Request) {
  const token = await verifyApiToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Invalid or missing API token" },
      { status: 401 }
    );
  }
  if (!tokenHasScope(token, "read:decisions")) {
    return NextResponse.json(
      { error: "Token lacks read:decisions scope" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 500);
  const status = searchParams.get("status");

  const decisions = await prisma.decision.findMany({
    where: status ? { status } : undefined,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      direction: true,
      status: true,
      outcome: true,
      outcomeDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: decisions, count: decisions.length });
}
