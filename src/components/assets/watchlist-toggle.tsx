"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addToWatchlist, removeFromWatchlist } from "@/actions/assets";

interface WatchlistToggleProps {
  assetTicker: string;
  isOnWatchlist: boolean;
}

export function WatchlistToggle({ assetTicker, isOnWatchlist }: WatchlistToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      if (isOnWatchlist) {
        const result = await removeFromWatchlist({ assetTicker });
        if (result.error) setError(result.error);
      } else {
        const result = await addToWatchlist({ assetTicker });
        if (result.error) setError(result.error);
      }
    });
  }

  return (
    <div>
      <Button
        variant={isOnWatchlist ? "outline" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isOnWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
