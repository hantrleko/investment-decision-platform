import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { toCsv, csvResponse } from "@/lib/export/csv";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decisions = await prisma.decision.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      researchLinks: true,
      scoreLinks: true,
    },
  });

  const csv = toCsv(decisions, [
    { header: "ID", value: (d) => d.id },
    { header: "Title", value: (d) => d.title },
    { header: "Direction", value: (d) => d.direction },
    { header: "Status", value: (d) => d.status },
    { header: "Outcome", value: (d) => d.outcome },
    { header: "Outcome Note", value: (d) => d.outcomeNote },
    { header: "Outcome Date", value: (d) => d.outcomeDate },
    { header: "Linked Research", value: (d) => d.researchLinks.length },
    { header: "Linked Scores", value: (d) => d.scoreLinks.length },
    { header: "Thesis", value: (d) => d.thesis },
    { header: "Created At", value: (d) => d.createdAt },
  ]);

  const filename = `decisions-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(csv, filename);
}
