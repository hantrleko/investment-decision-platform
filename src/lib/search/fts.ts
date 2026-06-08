import { prisma } from "@/lib/db";

export async function searchResearch(query: string, limit = 20) {
  if (!query.trim()) return [];

  const results = await prisma.$queryRaw<Array<{ rowid: number; rank: number }>>`
    SELECT rowid, rank
    FROM research_search
    WHERE research_search MATCH ${query}
    ORDER BY rank
    LIMIT ${limit}
  `;

  if (results.length === 0) return [];

  const ids = results.map((r) => r.rowid);
  const artifacts = await prisma.researchArtifact.findMany({
    where: {
      id: { in: ids.map(String) },
    },
    include: {
      asset: { select: { ticker: true, name: true } },
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return artifacts;
}
