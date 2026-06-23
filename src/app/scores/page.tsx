import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/scoring/score-card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ScoresPage() {
  const scores = await prisma.score.findMany({
    orderBy: { scoredAt: "desc" },
    take: 50,
    include: {
      framework: { select: { name: true } },
      asset: { select: { ticker: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Framework Scores</h1>
        <Link href="/scores/new">
          <Button>New Score</Button>
        </Link>
      </div>

      {scores.length === 0 ? (
        <EmptyState
          title="No scores yet"
          description="Score an asset using a framework to quantify your investment thesis"
          actionLabel="Score an Asset"
          actionHref="/scores/new"
        />
      ) : (
        <div className="space-y-2">
          {scores.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/30">
              <div className="flex items-center gap-3">
                <Link href={`/assets/${s.assetTicker}`} className="text-sm font-medium text-primary hover:underline">
                  {s.assetTicker}
                </Link>
                <span className="text-sm text-muted-foreground">{s.asset.name}</span>
              </div>
              <ScoreCard
                id={s.id}
                frameworkName={s.framework.name}
                compositeScore={s.compositeScore}
                manualOverride={s.manualOverride}
                scoredAt={s.scoredAt}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
