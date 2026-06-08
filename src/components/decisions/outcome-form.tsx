"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recordOutcome } from "@/actions/decisions";

interface OutcomeFormProps {
  decisionId: string;
}

export function OutcomeForm({ decisionId }: OutcomeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"correct" | "incorrect" | "partial">("correct");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await recordOutcome({ decisionId, outcome, outcomeNote });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Record Outcome</h3>

      <div className="flex gap-2">
        {(["correct", "incorrect", "partial"] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutcome(o)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              outcome === o
                ? o === "correct"
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : o === "incorrect"
                  ? "border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                  : "border-yellow-600 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
                : "hover:bg-accent"
            }`}
          >
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </button>
        ))}
      </div>

      <textarea
        value={outcomeNote}
        onChange={(e) => setOutcomeNote(e.target.value)}
        placeholder="Optional notes on the outcome"
        rows={3}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Recording..." : "Record Outcome"}
      </Button>
    </form>
  );
}
