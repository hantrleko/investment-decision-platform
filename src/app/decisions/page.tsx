import { prisma } from "@/lib/db";
import { DecisionForm } from "@/components/decisions/decision-form";
import { DecisionCard } from "@/components/decisions/decision-card";
import { EmptyState } from "@/components/shared/empty-state";

interface PageProps {
  searchParams: Promise<{ status?: string; direction?: string }>;
}

export default async function DecisionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && ["open", "closed"].includes(params.status)) {
    where.status = params.status;
  }
  if (params.direction && ["bullish", "bearish", "neutral"].includes(params.direction)) {
    where.direction = params.direction;
  }

  const decisions = await prisma.decision.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const researchArtifacts = await prisma.researchArtifact.findMany({
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  const scores = await prisma.score.findMany({
    select: { id: true, compositeScore: true, framework: { select: { name: true } } },
    orderBy: { scoredAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Decision Journal</h1>
      </div>

      {/* New decision form */}
      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">New Decision</h2>
        <DecisionForm
          researchArtifacts={researchArtifacts}
          scores={scores.map((s) => ({
            id: s.id,
            frameworkName: s.framework.name,
            compositeScore: s.compositeScore,
          }))}
        />
      </section>

      {/* Filters */}
      <div className="flex gap-2">
        <a
          href="/decisions"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent ${
            !params.status && !params.direction ? "bg-accent" : ""
          }`}
        >
          All
        </a>
        {["open", "closed"].map((s) => (
          <a
            key={s}
            href={`/decisions?status=${s}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent capitalize ${
              params.status === s ? "bg-accent" : ""
            }`}
          >
            {s}
          </a>
        ))}
        <span className="text-muted-foreground mx-1">|</span>
        {["bullish", "bearish", "neutral"].map((d) => (
          <a
            key={d}
            href={`/decisions?direction=${d}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent capitalize ${
              params.direction === d ? "bg-accent" : ""
            }`}
          >
            {d}
          </a>
        ))}
      </div>

      {/* Decision list */}
      {decisions.length === 0 ? (
        <EmptyState
          title="No decisions yet"
          description="Record your first investment decision above to start tracking outcomes"
        />
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => (
            <DecisionCard
              key={d.id}
              id={d.id}
              title={d.title}
              direction={d.direction}
              status={d.status}
              outcome={d.outcome}
              createdAt={d.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
