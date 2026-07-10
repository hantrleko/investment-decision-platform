import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/export/csv";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recs = await prisma.recommendation.findMany({
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(recs, [
    { header: "ID", value: (r) => r.id },
    { header: "Strategy", value: (r) => r.strategyName },
    { header: "Strategy Slug", value: (r) => r.strategySlug },
    { header: "Version", value: (r) => r.strategyVersion },
    { header: "Asset", value: (r) => r.assetTicker },
    { header: "Recommendation", value: (r) => r.recommendation },
    { header: "Converted Decision", value: (r) => r.convertedDecisionId },
    { header: "Reasoning", value: (r) => r.reasoning },
    { header: "Created At", value: (r) => r.createdAt },
  ]);

  const filename = `recommendations-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(csv, filename);
}
