"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { overrideComposite } from "@/actions/scoring";

interface OverrideFormProps {
  scoreId: string;
  currentComposite: number | null;
}

export function OverrideForm({ scoreId, currentComposite }: OverrideFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  const [overrideValue, setOverrideValue] = useState(currentComposite?.toFixed(1) ?? "5.0");
  const [overrideNote, setOverrideNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!show) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShow(true)}>
        Override Composite
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(overrideValue);
    if (isNaN(value) || value < 0 || value > 10) {
      setError("Value must be between 0 and 10");
      return;
    }

    startTransition(async () => {
      const result = await overrideComposite({
        scoreId,
        overrideValue: value,
        overrideNote,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setShow(false);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      <h4 className="text-sm font-medium">Override Composite Score</h4>
      <div className="space-y-2">
        <label className="text-xs font-medium">Override Value (0–10)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={overrideValue}
          onChange={(e) => setOverrideValue(e.target.value)}
          className="w-full rounded-md border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">Reason for override *</label>
        <input
          type="text"
          value={overrideNote}
          onChange={(e) => setOverrideNote(e.target.value)}
          placeholder="Why are you overriding the composite?"
          required
          className="w-full rounded-md border bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Apply Override"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShow(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
