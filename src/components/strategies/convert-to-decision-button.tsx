"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { convertRecommendationToDecision } from "@/actions/strategies";

interface ConvertToDecisionButtonProps {
  recommendationId: string;
  alreadyConverted: boolean;
  convertedDecisionId?: string;
}

export function ConvertToDecisionButton({
  recommendationId,
  alreadyConverted,
  convertedDecisionId,
}: ConvertToDecisionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConvert() {
    setError(null);
    startTransition(async () => {
      const result = await convertRecommendationToDecision({
        recommendationId,
      });
      if (result.error || !result.data) {
        setError(result.error || "Conversion failed");
        return;
      }
      router.push(`/decisions/${result.data.decisionId}`);
      router.refresh();
    });
  }

  if (alreadyConverted && convertedDecisionId) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Converted to decision</span>
        <Button variant="outline" size="sm" onClick={() => router.push(`/decisions/${convertedDecisionId}`)}>
          View Decision
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConvert} disabled={isPending}>
        {isPending ? "Converting..." : "Convert to Decision"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
