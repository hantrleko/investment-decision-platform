import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { OutcomeForm } from "@/components/decisions/outcome-form";
import { EntityBadge } from "@/components/shared/entity-badge";
import { DecisionCard } from "@/components/decisions/decision-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DecisionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const decision = await prisma.decision.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, email: true } },
      researchLinks: {
        include: {
          researchArtifact: {
            select: { id: true, title: true, assetTicker: true },
          },
        },
      },
      scoreLinks: {
        include: {
          score: {
            select: {
              id: true,
              compositeScore: true,
              manualOverride: true,
              framework: { select: { name: true } },
              assetTicker: true,
            },
          },
        },
      },
    },
  });

  if (!decision) {
    notFound();
  }

  const isOpen = decision.status === "open";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{decision.title}</h1>
          <DecisionCard
            id={decision.id}
            title={decision.title}
            direction={decision.direction}
            status={decision.status}
            outcome={decision.outcome}
            createdAt={decision.createdAt}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Created {decision.createdAt.toLocaleDateString()} · By {decision.author.name || decision.author.email}
        </p>
      </div>

      {/* Thesis */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Thesis</h2>
        <div className="rounded-md border p-4 text-sm whitespace-pre-wrap">{decision.thesis}</div>
      </section>

      <Separator />

      {/* Linked Research (D5) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Linked Research</h2>
        {decision.researchLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No research artifacts linked.</p>
        ) : (
          <div className="space-y-2">
            {decision.researchLinks.map((link) => (
              <a
                key={link.researchArtifactId}
                href={`/research/${link.researchArtifact.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <EntityBadge
                  href={`/research/${link.researchArtifact.id}`}
                  label={link.researchArtifact.title}
                  variant="research"
                />
                {link.researchArtifact.assetTicker && (
                  <EntityBadge
                    href={`/assets/${link.researchArtifact.assetTicker}`}
                    label={link.researchArtifact.assetTicker}
                    variant="asset"
                  />
                )}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Linked Scores (D5) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Linked Scores</h2>
        {decision.scoreLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores linked.</p>
        ) : (
          <div className="space-y-2">
            {decision.scoreLinks.map((link) => (
              <a
                key={link.scoreId}
                href={`/scores/${link.score.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <EntityBadge
                  href={`/scores/${link.score.id}`}
                  label={link.score.framework.name}
                  variant="score"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {link.score.manualOverride ? "Override" : link.score.compositeScore?.toFixed(2) ?? "—"}
                  </span>
                  <EntityBadge
                    href={`/assets/${link.score.assetTicker}`}
                    label={link.score.assetTicker}
                    variant="asset"
                  />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Outcome (D6) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Outcome</h2>
        {isOpen ? (
          <OutcomeForm decisionId={id} />
        ) : (
          <div className="rounded-md border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Result:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                decision.outcome === "correct" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : decision.outcome === "incorrect" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              }`}>
                {decision.outcome}
              </span>
            </div>
            {decision.outcomeNote && (
              <p className="text-sm">{decision.outcomeNote}</p>
            )}
            {decision.outcomeDate && (
              <p className="text-xs text-muted-foreground">Recorded {decision.outcomeDate.toLocaleDateString()}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
