"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { bulkRefreshWatchlistPrices, type BulkRefreshResult } from "@/actions/assets";

interface WatchlistRefreshButtonProps {
  count: number;
}

export function WatchlistRefreshButton({ count }: WatchlistRefreshButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkRefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setError(null);
    setResult(null);

    startTransition(async () => {
      const res = await bulkRefreshWatchlistPrices();
      if (res.error || !res.data) {
        setError(res.error || "Refresh failed");
        return;
      }
      setResult(res.data);
    });
  }

  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending}>
          {isPending ? "Refreshing..." : "Refresh All Prices"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="rounded-md border p-3 text-xs space-y-1">
          {result.updated.length > 0 && (
            <p className="text-green-700 dark:text-green-400">
              Updated: {result.updated.length} ({result.updated.map((u) => `${u.ticker} $${u.lastPrice.toFixed(2)}`).join(", ")})
            </p>
          )}
          {result.failed.length > 0 && (
            <p className="text-destructive">
              Failed: {result.failed.length} ({result.failed.map((f) => `${f.ticker}: ${f.error}`).join(", ")})
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-muted-foreground">
              Skipped (no price): {result.skipped.join(", ")}
            </p>
          )}
          {result.updated.length === 0 && result.failed.length === 0 && result.skipped.length === 0 && (
            <p className="text-muted-foreground">No assets to refresh.</p>
          )}
        </div>
      )}
    </div>
  );
}
