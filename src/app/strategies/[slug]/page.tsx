import { notFound } from "next/navigation";
import Link from "next/link";
import { getStrategyConfig } from "@/actions/strategies";
import { getStrategyReviewDataForSlug } from "@/actions/strategy-review";
import { StrategyConfigForm } from "@/components/strategies/strategy-config-form";
import { StrategyToggle } from "@/components/strategies/strategy-toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const REC_STYLES: Record<string, string> = {
  "Strong Buy": "text-green-700 dark:text-green-400 font-bold",
  Buy: "text-green-600 dark:text-green-400",
  Watch: "text-blue-600 dark:text-blue-400",
  Review: "text-yellow-600 dark:text-yellow-400",
  Avoid: "text-red-600 dark:text-red-400",
  Reject: "text-red-700 dark:text-red-500 font-bold",
};

export default async function StrategyManagePage({ params }: PageProps) {
  const { slug } = await params;
  const strategy = await getStrategyConfig(slug);

  if (!strategy) {
    notFound();
  }

  // Fetch review data for this strategy
  const reviewData = await getStrategyReviewDataForSlug(slug);
  const summary = reviewData.summary;
  const items = reviewData.items.slice(0, 10); // Recent 10

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{strategy.name}</h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              strategy.active
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {strategy.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{strategy.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Version {strategy.version}
          {strategy.requiredFrameworkSlugs.length > 0 && (
            <> · Requires: {strategy.requiredFrameworkSlugs.join(", ")}</>
          )}
        </p>
      </div>

      <Separator />

      {/* Review metrics */}
      {summary && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Review Metrics</h2>
            <Link href={`/strategies/review?strategy=${slug}`}>
              <Button variant="outline" size="sm">Full Review →</Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Recommendations</p>
              <p className="text-xl font-bold">{summary.totalRecommendations}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Converted</p>
              <p className="text-xl font-bold">{summary.convertedCount}</p>
              <p className="text-xs text-muted-foreground">
                {(summary.conversionRate * 100).toFixed(0)}% rate
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Closed Decisions</p>
              <p className="text-xl font-bold">{summary.closedDecisionsCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Outcomes</p>
              <p className="text-sm">
                <span className="text-green-600 dark:text-green-400">{summary.correctCount} correct</span>
                {" · "}
                <span className="text-red-600 dark:text-red-400">{summary.incorrectCount} incorrect</span>
                {" · "}
                <span className="text-yellow-600 dark:text-yellow-400">{summary.partialCount} partial</span>
              </p>
            </div>
          </div>
        </section>
      )}

      <Separator />

      {/* Recent recommendations for this strategy */}
      {items.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Recommendations</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/recommendations/${item.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <Link href={`/assets/${item.assetTicker}`} className="text-sm font-medium text-primary hover:underline">
                    {item.assetTicker}
                  </Link>
                  <span className={`text-sm ${REC_STYLES[item.recommendation] || ""}`}>
                    {item.recommendation}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.converted ? (
                    <span className="text-xs text-muted-foreground">
                      {item.decisionStatus ?? "converted"}
                      {item.decisionOutcome && ` · ${item.decisionOutcome}`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">not converted</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {item.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* Toggle active/inactive */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Status</h2>
        <div className="flex items-center gap-3">
          <StrategyToggle slug={strategy.slug} active={strategy.active} />
          <p className="text-xs text-muted-foreground">
            Inactive strategies cannot be run.
          </p>
        </div>
      </section>

      <Separator />

      {/* Config form */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Configuration</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Adjust rule thresholds for this strategy. Changes apply to new recommendations.
        </p>
        <StrategyConfigForm
          slug={strategy.slug}
          config={strategy.config}
          configSchema={strategy.configSchema}
        />
      </section>

      <Separator />

      {/* Config summary */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Current Config (JSON)</h2>
        <pre className="rounded-md border bg-muted/50 p-3 text-xs overflow-x-auto">
          {JSON.stringify(strategy.config, null, 2)}
        </pre>
      </section>

      <div className="flex gap-3">
        <Link href="/strategies">
          <Button variant="outline" size="sm">← Back to Strategies</Button>
        </Link>
      </div>
    </div>
  );
}
