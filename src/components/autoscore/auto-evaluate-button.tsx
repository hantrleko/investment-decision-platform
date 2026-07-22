"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  autoEvaluateAsset,
  type AutoEvaluateResult,
} from "@/actions/autoscore";

interface AutoEvaluateButtonProps {
  ticker: string;
  /** Visual size of the primary button. */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show a longer label. */
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
}

export function AutoEvaluateButton({
  ticker,
  size = "sm",
  label = "Auto Evaluate",
  variant = "default",
  className,
}: AutoEvaluateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoEvaluateResult | null>(null);

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await autoEvaluateAsset({ ticker });
      if (res.error || !res.data) {
        setError(res.error || "Auto evaluation failed");
        return;
      }
      setResult(res.data);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={handleClick}
        disabled={isPending}
        title="Fetch Yahoo fundamentals + OHLCV, auto-score Valuation/Trend/Macro, run multi-signal strategy"
      >
        {isPending ? "Evaluating…" : label}
      </Button>

      {error && (
        <p className="max-w-xs text-xs text-destructive text-right">{error}</p>
      )}

      {result && (
        <div className="max-w-sm rounded-md border bg-card p-3 text-left text-xs shadow-sm space-y-2">
          <p className="font-semibold text-sm">
            Auto evaluation complete — {result.ticker}
          </p>

          <ul className="space-y-1">
            {result.scores.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <Link
                  href={`/scores/${s.id}`}
                  className="text-primary hover:underline"
                >
                  {s.frameworkName}
                </Link>
                <span className="font-mono font-medium">
                  {s.compositeScore.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          {result.recommendation && (
            <p>
              Strategy:{" "}
              {result.recommendationId ? (
                <Link
                  href={`/recommendations/${result.recommendationId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {result.recommendation}
                </Link>
              ) : (
                <span className="font-semibold">{result.recommendation}</span>
              )}
            </p>
          )}

          {result.researchId && (
            <p>
              <Link
                href={`/research/${result.researchId}`}
                className="text-primary hover:underline"
              >
                View auto research report →
              </Link>
            </p>
          )}

          {result.warnings.length > 0 && (
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">
                {result.warnings.length} warning
                {result.warnings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {result.warnings.slice(0, 8).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
