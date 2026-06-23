import { prisma } from "@/lib/db";
import { getAvailableStrategies } from "@/actions/strategies";
import { getStrategyReviewData } from "@/actions/strategy-review";
import { StrategyRunner } from "@/components/strategies/strategy-runner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

  // Fetch review summary for the overview table
  const reviewData = await getStrategyReviewData();

  const REC_STYLES: Record<string, string> = {
    "Strong Buy": "text-green-700 dark:text-green-400 font-bold",
    Buy: "text-green-600 dark:text-green-400",
    Watch: "text-blue-600 dark:text-blue-400",
    Review: "text-yellow-600 dark:text-yellow-400",
    Avoid: "text-red-600 dark:text-red-400",
    Reject: "text-red-700 dark:text-red-500 font-bold",
  };

  // Only active strategies can be run
  const activeStrategies = strategies.filter((s) => s.active);
  // Strategies with at least 1 recommendation for the summary table
  const strategiesWithRecs = reviewData.summaries.filter((s) => s.totalRecommendations > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Strategy Engine</h1>
        <Link href="/strategies/review">
          <Button variant="outline" size="sm">Review & Analytics →</Button>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Run built-in strategies to generate explainable recommendations from your framework scores.
        Configure thresholds, enable/disable strategies, and track which configs produce the best outcomes.
      </p>

      {/* Strategy summary table (only if recommendations exist) */}
      {strategiesWithRecs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Strategy</th>
                  <th className="pb-2 pr-4 font-medium text-right">Recs</th>
                  <th className="pb-2 pr-4 font-medium text-right">Converted</th>
                  <th className="pb-2 pr-4 font-medium text-right">Conv. Rate</th>
                  <th className="pb-2 pr-4 font-medium text-right">Closed</th>
                  <th className="pb-2 pr-4 font-medium text-right">Correct</th>
                  <th className="pb-2 pr-4 font-medium text-right">Incorrect</th>
                </tr>
              </thead>
              <tbody>
                {strategiesWithRecs.map((s) => (
                  <tr key={s.slug} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/strategies/${s.slug}`} className="text-primary hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{s.totalRecommendations}</td>
                    <td className="py-2 pr-4 text-right font-mono">{s.convertedCount}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {(s.conversionRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{s.closedDecisionsCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-600 dark:text-green-400">{s.correctCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-red-600 dark:text-red-400">{s.incorrectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Strategy management cards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Available Strategies</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {strategies.map((s) => (
            <Link
              key={s.slug}
              href={`/strategies/${s.slug}`}
              className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.active
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">v{s.version}</p>
              {s.requiredFrameworkSlugs.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Requires: {s.requiredFrameworkSlugs.join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-primary hover:underline">Configure →</p>
            </Link>
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
            actionLabel="Add Asset"
            actionHref="/assets/new"
          />
        ) : activeStrategies.length === 0 ? (
          <EmptyState
            title="No active strategies"
            description="Enable a strategy from the management page to run it."
          />
        ) : (
          <StrategyRunner strategies={activeStrategies} assets={assets} />
        )}
      </section>

      {/* Recent recommendations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Recommendations</h2>
        {recentRecommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            description="Run a strategy above to generate an explainable recommendation."
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
