import { notFound } from "next/navigation";
import Link from "next/link";
import { getStrategyConfig } from "@/actions/strategies";
import { StrategyConfigForm } from "@/components/strategies/strategy-config-form";
import { StrategyToggle } from "@/components/strategies/strategy-toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function StrategyManagePage({ params }: PageProps) {
  const { slug } = await params;
  const strategy = await getStrategyConfig(slug);

  if (!strategy) {
    notFound();
  }

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
