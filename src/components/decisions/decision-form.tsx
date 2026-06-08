"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createDecision } from "@/actions/decisions";

interface ResearchItem { id: string; title: string }
interface ScoreItem { id: string; frameworkName: string; compositeScore: number | null }

interface DecisionFormProps {
  researchArtifacts: ResearchItem[];
  scores: ScoreItem[];
}

export function DecisionForm({ researchArtifacts, scores }: DecisionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [thesis, setThesis] = useState("");
  const [selectedResearch, setSelectedResearch] = useState<Set<string>>(new Set());
  const [selectedScores, setSelectedScores] = useState<Set<string>>(new Set());

  function toggleResearch(id: string) {
    setSelectedResearch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleScore(id: string) {
    setSelectedScores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createDecision({
        title,
        direction,
        thesis,
        researchArtifactIds: Array.from(selectedResearch),
        scoreIds: Array.from(selectedScores),
      });

      if (result.error || !result.data) {
        setError(result.error || "Unknown error");
        return;
      }

      router.push(`/decisions/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Go long AAPL ahead of Q3 earnings"
          required
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Direction</label>
        <div className="flex gap-2">
          {(["bullish", "bearish", "neutral"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                direction === d
                  ? d === "bullish"
                    ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                    : d === "bearish"
                    ? "border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                    : "border-yellow-600 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
                  : "hover:bg-accent"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="thesis" className="text-sm font-medium">Thesis</label>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={5}
          required
          placeholder="What is your rationale for this decision?"
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Link research artifacts (D2) */}
      {researchArtifacts.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Link Research Artifacts</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {researchArtifacts.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedResearch.has(r.id)}
                  onChange={() => toggleResearch(r.id)}
                  className="rounded"
                />
                <span className="text-sm">{r.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Link scores (D3) */}
      {scores.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Link Scores</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {scores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedScores.has(s.id)}
                  onChange={() => toggleScore(s.id)}
                  className="rounded"
                />
                <span className="text-sm">{s.frameworkName} — {s.compositeScore?.toFixed(2) ?? "—"}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Create Decision"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
