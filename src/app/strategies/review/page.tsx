import { prisma } from "@/lib/db";
import { getStrategyReviewData } from "@/actions/strategy-review";
import type { ReviewFilters } from "@/lib/analytics/strategy-review";
import { ReviewFilters as ReviewFiltersComponent } from "@/components/strategies/review-filters";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const REC_STYLES: Record<string, string> = {
  "Strong Buy": "text-green-700 dark:text-green-400 font-bold",
  Buy: "text-green-600 dark:text-green-400",
  Watch: "text-blue-600 dark:text-blue-400",
  Review: "text-yellow-600 dark:text-yellow-400",
  Avoid: "text-red-600 dark:text-red-400",
  Reject: "text-red-700 dark:text-red-500 font-bold",
};

const OUTCOME_STYLES: Record<string, string> = {
  correct: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  incorrect: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StrategyReviewPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const filters: ReviewFilters = {
    strategySlug: typeof sp.strategy === "string" ? sp.strategy : undefined,
    assetTicker: typeof sp.asset === "string" ? sp.asset : undefined,
    recommendationLevel: typeof sp.level === "string" ? sp.level : undefined,
    convertedOnly: sp.converted === "yes",
    unconvertedOnly: sp.converted === "no",
    outcome: typeof sp.outcome === "string" ? sp.outcome : undefined,
  };

  const data = await getStrategyReviewData(filters);

  // Fetch strategy + asset lists for filter dropdowns
  const strategies = await prisma.strategyConfig.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
  const assets = await prisma.asset.findMany({
    select: { ticker: true, name: true },
    orderBy: { ticker: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Strategy Review</h1>
        <Link href="/strategies">
          <Button variant="outline" size="sm">← Back to Strategies</Button>
        </Link>
      </div>

      {/* Filters */}
      <ReviewFiltersComponent
        strategies={strategies.map((s) => ({ slug: s.slug, name: s.name }))}
        assets={assets.map((a) => ({ ticker: a.ticker, name: a.name }))}
      />

      {/* Strategy summary metrics table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Strategy Summary</h2>
        {data.summaries.length === 0 ? (
          <EmptyState title="No strategies found" description="No strategy data available." />
        ) : (
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
                  <th className="pb-2 pr-4 font-medium text-right">Partial</th>
                </tr>
              </thead>
              <tbody>
                {data.summaries.map((s) => (
                  <tr key={s.slug} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/strategies/${s.slug}`} className="text-primary hover:underline">
                        {s.name}
                      </Link>
                      {!s.active && (
                        <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{s.totalRecommendations}</td>
                    <td className="py-2 pr-4 text-right font-mono">{s.convertedCount}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {(s.conversionRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{s.closedDecisionsCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-600 dark:text-green-400">{s.correctCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-red-600 dark:text-red-400">{s.incorrectCount}</td>
                    <td className="py-2 pr-4 text-right font-mono text-yellow-600 dark:text-yellow-400">{s.partialCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recommendation level analytics */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recommendation Level Analytics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Level</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 pr-4 font-medium text-right">Converted</th>
                <th className="pb-2 pr-4 font-medium text-right">Closed</th>
                <th className="pb-2 pr-4 font-medium text-right">Correct</th>
                <th className="pb-2 pr-4 font-medium text-right">Incorrect</th>
                <th className="pb-2 pr-4 font-medium text-right">Partial</th>
              </tr>
            </thead>
            <tbody>
              {data.levelBreakdowns.map((lb) => (
                <tr key={lb.level} className="border-b last:border-0">
                  <td className={`py-2 pr-4 ${REC_STYLES[lb.level] || ""}`}>{lb.level}</td>
                  <td className="py-2 pr-4 text-right font-mono">{lb.total}</td>
                  <td className="py-2 pr-4 text-right font-mono">{lb.converted}</td>
                  <td className="py-2 pr-4 text-right font-mono">{lb.closed}</td>
                  <td className="py-2 pr-4 text-right font-mono text-green-600 dark:text-green-400">{lb.correct}</td>
                  <td className="py-2 pr-4 text-right font-mono text-red-600 dark:text-red-400">{lb.incorrect}</td>
                  <td className="py-2 pr-4 text-right font-mono text-yellow-600 dark:text-yellow-400">{lb.partial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recommendation review list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Recommendations ({data.items.length})
        </h2>
        {data.items.length === 0 ? (
          <EmptyState
            title="No recommendations match the filters"
            description="Adjust filters or run a strategy to generate recommendations."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Strategy</th>
                  <th className="pb-2 pr-4 font-medium">Asset</th>
                  <th className="pb-2 pr-4 font-medium">Level</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Converted</th>
                  <th className="pb-2 pr-4 font-medium">Decision Status</th>
                  <th className="pb-2 pr-4 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="py-2 pr-4">
                      <Link href={`/strategies/${item.strategySlug}`} className="text-primary hover:underline">
                        {item.strategyName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/assets/${item.assetTicker}`} className="text-primary hover:underline">
                        {item.assetTicker}
                      </Link>
                    </td>
                    <td className={`py-2 pr-4 ${REC_STYLES[item.recommendation] || ""}`}>
                      {item.recommendation}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {item.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      {item.converted ? (
                        item.decisionId ? (
                          <Link href={`/decisions/${item.decisionId}`} className="text-primary hover:underline text-xs">
                            view decision
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">yes</span>
                        )
                      ) : (
                        <Link href={`/recommendations/${item.id}`} className="text-xs text-muted-foreground hover:underline">
                          not converted
                        </Link>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {item.decisionStatus ? (
                        <span className={
                          item.decisionStatus === "closed"
                            ? "text-muted-foreground"
                            : "text-blue-600 dark:text-blue-400"
                        }>
                          {item.decisionStatus}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {item.decisionOutcome ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[item.decisionOutcome] || ""}`}>
                          {item.decisionOutcome}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
