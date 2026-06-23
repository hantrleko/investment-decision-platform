import { prisma } from "@/lib/db";
import { getAvailableStrategies } from "@/actions/strategies";
import { StrategyRunner } from "@/components/strategies/strategy-runner";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";

export default async function StrategiesPage() {
  const strategies = await getAvailableStrategies();
  const assets = await prisma.asset.findMany({
    select: { ticker: true, name: true },
    orderBy: { ticker: "asc" },
    take: 100,
  });

  const recentRecommendations = await prisma.recommendation.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      strategyName: true,
      assetTicker: true,
      recommendation: true,
      createdAt: true,
      convertedDecisionId: true,
    },
  });

  const REC_STYLES: Record<string, string> = {
    "Strong Buy": "text-green-700 dark:text-green-400 font-bold",
    Buy: "text-green-600 dark:text-green-400",
    Watch: "text-blue-600 dark:text-blue-400",
    Review: "text-yellow-600 dark:text-yellow-400",
    Avoid: "text-red-600 dark:text-red-400",
    Reject: "text-red-700 dark:text-red-500 font-bold",
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Strategy Engine</h1>

      {/* Strategy descriptions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Available Strategies</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {strategies.map((s) => (
            <div key={s.slug} className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">v{s.version}</p>
              {s.requiredFrameworkSlugs.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Requires: {s.requiredFrameworkSlugs.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Strategy runner */}
      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Run a Strategy</h2>
        {assets.length === 0 ? (
          <EmptyState
            title="No assets available"
            description="Create assets first before running strategies."
          />
        ) : (
          <StrategyRunner strategies={strategies} assets={assets} />
        )}
      </section>

      {/* Recent recommendations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Recommendations</h2>
        {recentRecommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            description="Run a strategy to generate a recommendation."
          />
        ) : (
          <div className="space-y-2">
            {recentRecommendations.map((rec) => (
              <Link
                key={rec.id}
                href={`/recommendations/${rec.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{rec.strategyName}</span>
                  <span className="text-sm text-muted-foreground">{rec.assetTicker}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${REC_STYLES[rec.recommendation] || ""}`}>
                    {rec.recommendation}
                  </span>
                  {rec.convertedDecisionId && (
                    <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                      converted
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {rec.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
