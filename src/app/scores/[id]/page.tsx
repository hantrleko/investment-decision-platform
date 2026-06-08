import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { OverrideForm } from "@/components/scoring/override-form";
import { EntityBadge } from "@/components/shared/entity-badge";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScoreDetailPage({ params }: PageProps) {
  const { id } = await params;

  const score = await prisma.score.findUnique({
    where: { id },
    include: {
      framework: { select: { name: true, slug: true, schemaDefinition: true } },
      asset: { select: { ticker: true, name: true } },
      researchArtifact: { select: { id: true, title: true } },
    },
  });

  if (!score) {
    notFound();
  }

  const schema = JSON.parse(score.framework.schemaDefinition);
  const factorScores: Record<string, { value: number; note?: string }> = JSON.parse(score.factorScores);
  const provenance = JSON.parse(score.provenance);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{score.framework.name} Score</h1>
          {score.manualOverride && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Override
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <EntityBadge
            href={`/assets/${score.assetTicker}`}
            label={`${score.assetTicker} — ${score.asset.name}`}
            variant="asset"
          />
          <span>Scored {score.scoredAt.toLocaleDateString()}</span>
        </div>
      </div>

      {/* Composite */}
      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Composite Score</span>
          <span className="text-2xl font-bold font-mono">
            {score.compositeScore?.toFixed(2) ?? "—"}
          </span>
        </div>
        {score.manualOverride && score.overrideNote && (
          <p className="mt-2 text-xs text-muted-foreground">
            Override reason: {score.overrideNote}
          </p>
        )}
      </div>

      <OverrideForm scoreId={id} currentComposite={score.compositeScore} />

      <Separator />

      {/* Factor breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Factor Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Factor</th>
              <th className="pb-2 pr-4 font-medium text-center">Score</th>
              <th className="pb-2 pr-4 font-medium text-center">Weight</th>
              <th className="pb-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {schema.factors.map((f: { slug: string; label: string; weight: number }) => {
              const fs = factorScores[f.slug];
              return (
                <tr key={f.slug} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">{f.label}</td>
                  <td className="py-1.5 pr-4 text-center font-mono">{fs?.value ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-center text-muted-foreground">{(f.weight * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-muted-foreground">{fs?.note || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Separator />

      {/* Provenance */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Provenance</h2>
        <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
          <p><span className="font-medium">Source:</span> {provenance.source}</p>
          <p><span className="font-medium">Timestamp:</span> {new Date(provenance.timestamp).toLocaleString()}</p>
          {provenance.artifactId && (
            <p>
              <span className="font-medium">Research Artifact:</span>{" "}
              {score.researchArtifact ? (
                <Link href={`/research/${score.researchArtifact.id}`} className="text-primary hover:underline">
                  {score.researchArtifact.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">{provenance.artifactId}</span>
              )}
            </p>
          )}
          {provenance.note && (
            <p><span className="font-medium">Note:</span> {provenance.note}</p>
          )}
        </div>
      </section>
    </div>
  );
}
