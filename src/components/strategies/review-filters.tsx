"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface StrategyOption {
  slug: string;
  name: string;
}

interface AssetOption {
  ticker: string;
  name: string;
}

interface ReviewFiltersProps {
  strategies: StrategyOption[];
  assets: AssetOption[];
  experimentLabels?: string[];
}

const REC_LEVELS = ["Strong Buy", "Buy", "Watch", "Review", "Avoid", "Reject"];
const OUTCOMES = ["correct", "incorrect", "partial"];

export function ReviewFilters({ strategies, assets, experimentLabels = [] }: ReviewFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/strategies/review?${params.toString()}`);
    },
    [router, searchParams]
  );

  const selectClass =
    "rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Strategy</label>
        <select
          className={selectClass}
          value={searchParams.get("strategy") ?? "all"}
          onChange={(e) => updateFilter("strategy", e.target.value)}
        >
          <option value="all">All strategies</option>
          {strategies.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Asset</label>
        <select
          className={selectClass}
          value={searchParams.get("asset") ?? "all"}
          onChange={(e) => updateFilter("asset", e.target.value)}
        >
          <option value="all">All assets</option>
          {assets.map((a) => (
            <option key={a.ticker} value={a.ticker}>{a.ticker}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Level</label>
        <select
          className={selectClass}
          value={searchParams.get("level") ?? "all"}
          onChange={(e) => updateFilter("level", e.target.value)}
        >
          <option value="all">All levels</option>
          {REC_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Converted</label>
        <select
          className={selectClass}
          value={searchParams.get("converted") ?? "all"}
          onChange={(e) => updateFilter("converted", e.target.value)}
        >
          <option value="all">All</option>
          <option value="yes">Converted only</option>
          <option value="no">Unconverted only</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Outcome</label>
        <select
          className={selectClass}
          value={searchParams.get("outcome") ?? "all"}
          onChange={(e) => updateFilter("outcome", e.target.value)}
        >
          <option value="all">All outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {experimentLabels.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Experiment</label>
          <select
            className={selectClass}
            value={searchParams.get("experiment") ?? "all"}
            onChange={(e) => updateFilter("experiment", e.target.value)}
          >
            <option value="all">All experiments</option>
            {experimentLabels.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
