"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAsset } from "@/actions/assets";

export function AssetForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [assetType, setAssetType] = useState("equity");
  const [exchange, setExchange] = useState("");
  const [notes, setNotes] = useState("");
  const [lastPrice, setLastPrice] = useState("");
  const [priceSource, setPriceSource] = useState<string>("");

  async function handleLookup() {
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setLookupError("Enter a ticker first");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/assets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLookupError(data.error || "Lookup failed");
        return;
      }
      if (data.name) setName(data.name);
      if (data.exchange) setExchange(data.exchange);
      if (data.sector) setSector(data.sector);
      if (data.lastPrice != null) {
        setLastPrice(String(data.lastPrice));
        setPriceSource("yahoo");
      }
    } catch {
      setLookupError("Network error — fill fields manually");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAsset({
        ticker, name, sector, assetType, exchange, notes,
        lastPrice: lastPrice ? parseFloat(lastPrice) : undefined,
        priceSource: priceSource || undefined,
      });
      if (result.error || !result.data) {
        setError(result.error || "Unknown error");
        return;
      }
      router.push(`/assets/${result.data.ticker}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="ticker" className="text-sm font-medium">Ticker *</label>
          <div className="flex gap-2">
            <input
              id="ticker"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
              required
              className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLookup}
              disabled={lookupLoading || !ticker}
            >
              {lookupLoading ? "..." : "Auto-lookup"}
            </Button>
          </div>
          {lookupError && <p className="text-xs text-amber-600 dark:text-amber-400">{lookupError}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apple Inc."
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="sector" className="text-sm font-medium">Sector</label>
          <input
            id="sector"
            type="text"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="e.g. Technology"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="assetType" className="text-sm font-medium">Type</label>
          <select
            id="assetType"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="equity">Equity</option>
            <option value="crypto">Crypto</option>
            <option value="fx">FX</option>
            <option value="commodity">Commodity</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="exchange" className="text-sm font-medium">Exchange</label>
          <input
            id="exchange"
            type="text"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            placeholder="e.g. NASDAQ"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="price" className="text-sm font-medium">Last Price</label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={lastPrice}
            onChange={(e) => {
              setLastPrice(e.target.value);
              if (e.target.value) setPriceSource("manual");
            }}
            placeholder="e.g. 150.25"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Source</label>
          <input
            type="text"
            value={priceSource || "manual"}
            readOnly
            className="w-full rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Asset"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
