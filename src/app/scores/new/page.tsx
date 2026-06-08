import { prisma } from "@/lib/db";
import { ScoringForm } from "@/components/scoring/scoring-form";

interface PageProps {
  searchParams: Promise<{ asset?: string }>;
}

export default async function NewScorePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const assetTicker = params.asset || "";

  if (!assetTicker) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">New Score</h1>
        <p className="text-muted-foreground">
          Please navigate to an asset detail page and click &quot;Score with Framework&quot; to start scoring.
        </p>
      </div>
    );
  }

  const asset = await prisma.asset.findUnique({
    where: { ticker: assetTicker },
    include: {
      researchArtifacts: {
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      scores: {
        select: { framework: { select: { slug: true } } },
      },
    },
  });

  if (!asset) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">New Score</h1>
        <p className="text-destructive">Asset &quot;{assetTicker}&quot; not found.</p>
      </div>
    );
  }

  const frameworks = await prisma.framework.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const alreadyScoredSlugs = [...new Set(asset.scores.map((s) => s.framework.slug))];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">
        Score {assetTicker}
        <span className="ml-2 text-lg font-normal text-muted-foreground">{asset.name}</span>
      </h1>
      <ScoringForm
        assetTicker={assetTicker}
        frameworks={frameworks.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          description: f.description,
          schemaDefinition: f.schemaDefinition,
        }))}
        researchArtifacts={asset.researchArtifacts}
        alreadyScoredSlugs={alreadyScoredSlugs}
      />
    </div>
  );
}
