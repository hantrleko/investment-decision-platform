"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runStrategy } from "@/actions/strategies";

interface StrategyInfo {
  slug: string;
  name: string;
  description: string;
  version: string;
  requiredFrameworkSlugs: string[];
}

interface StrategyRunnerProps {
  strategies: StrategyInfo[];
  assets: Array<{ ticker: string; name: string }>;
}

export function StrategyRunner({ strategies, assets }: StrategyRunnerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  function handleRun() {
    setError(null);
    if (!selectedStrategy || !selectedAsset) {
      setError("Select both a strategy and an asset");
      return;
    }

    startTransition(async () => {
      const result = await runStrategy({
        strategySlug: selectedStrategy,
        assetTicker: selectedAsset,
      });
      if (result.error || !result.data) {
        setError(result.error || "Strategy execution failed");
        return;
      }
      router.push(`/recommendations/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Strategy selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Strategy</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {strategies.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSelectedStrategy(s.slug)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selectedStrategy === s.slug
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-accent/50"
              }`}
            >
              <span className="text-sm font-medium">{s.name}</span>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
              {s.requiredFrameworkSlugs.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Requires: {s.requiredFrameworkSlugs.join(", ")}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Asset selection */}
      <div className="space-y-2">
        <label htmlFor="assetSelect" className="text-sm font-medium">Select Asset</label>
        <select
          id="assetSelect"
          value={selectedAsset}
          onChange={(e) => setSelectedAsset(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Choose an asset...</option>
          {assets.map((a) => (
            <option key={a.ticker} value={a.ticker}>
              {a.ticker} — {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleRun} disabled={isPending || !selectedStrategy || !selectedAsset}>
        {isPending ? "Running..." : "Run Strategy"}
      </Button>
    </div>
  );
}
