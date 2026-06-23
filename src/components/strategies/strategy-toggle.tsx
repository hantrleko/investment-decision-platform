"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleStrategyActive } from "@/actions/strategies";

interface StrategyToggleProps {
  slug: string;
  active: boolean;
}

export function StrategyToggle({ slug, active }: StrategyToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleStrategyActive({ slug });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleToggle}
        disabled={isPending}
        variant={active ? "destructive" : "default"}
        size="sm"
      >
        {isPending ? "..." : active ? "Deactivate" : "Activate"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
