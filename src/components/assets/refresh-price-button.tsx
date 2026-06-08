"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RefreshPriceButtonProps {
  ticker: string;
  currentPrice: number | null;
  currentPriceTs: string | null;
  currentSource: string | null;
}

export function RefreshPriceButton({
  ticker,
  currentPrice,
  currentPriceTs,
  currentSource,
}: RefreshPriceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(currentPrice);
  const [priceTs, setPriceTs] = useState<string | null>(currentPriceTs);
  const [source, setSource] = useState<string | null>(currentSource);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${ticker}/refresh-price`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Refresh failed");
        return;
      }
      setPrice(data.lastPrice);
      setPriceTs(data.lastPriceTs);
      setSource(data.priceSource);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {price != null ? (
          <span className="text-2xl font-bold font-mono">${price.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">No price</span>
        )}
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          {loading ? "Fetching..." : "Refresh Price"}
        </Button>
      </div>
      {priceTs && (
        <p className="text-xs text-muted-foreground">
          Updated {new Date(priceTs).toLocaleString()}
          {source && ` · Source: ${source}`}
        </p>
      )}
      {error && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {error} — you can enter price manually below
        </p>
      )}
    </div>
  );
}
