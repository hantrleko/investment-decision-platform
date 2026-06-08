"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FrameworkPicker } from "@/components/scoring/framework-picker";
import { createScore } from "@/actions/scoring";
import type { FrameworkSchema, FactorScore } from "@/lib/scoring/compute";
import { computeComposite } from "@/lib/scoring/compute";

interface ScoringFormProps {
  assetTicker: string;
  frameworks: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    schemaDefinition: string;
  }>;
  researchArtifacts: Array<{ id: string; title: string }>;
  alreadyScoredSlugs: string[];
}

export function ScoringForm({ assetTicker, frameworks, researchArtifacts, alreadyScoredSlugs }: ScoringFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string | null>(null);
  const [factorScores, setFactorScores] = useState<Record<string, FactorScore>>({});
  const [linkedResearchId, setLinkedResearchId] = useState<string>("");

  const selectedFramework = frameworks.find((f) => f.id === selectedFrameworkId);
  const schema: FrameworkSchema | null = selectedFramework
    ? JSON.parse(selectedFramework.schemaDefinition)
    : null;

  // Live composite preview
  const preview = schema ? computeComposite(schema, factorScores) : null;

  function handleFactorChange(slug: string, value: number, note?: string) {
    setFactorScores((prev) => ({
      ...prev,
      [slug]: { value, note: note || prev[slug]?.note },
    }));
  }

  function handleFactorNote(slug: string, note: string) {
    setFactorScores((prev) => ({
      ...prev,
      [slug]: { value: prev[slug]?.value ?? 0, note },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedFrameworkId) {
      setError("Select a framework first");
      return;
    }

    startTransition(async () => {
      const result = await createScore({
        frameworkId: selectedFrameworkId,
        assetTicker,
        researchArtifactId: linkedResearchId || undefined,
        factorScores,
      });

      if (result.error || !result.data) {
        setError(result.error || "Unknown error");
        return;
      }

      router.push(`/scores/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Framework picker */}
      <div>
        <label className="text-sm font-medium">Select Framework</label>
        <p className="text-xs text-muted-foreground mb-2">
          {alreadyScoredSlugs.length > 0
            ? `Already scored with: ${alreadyScoredSlugs.join(", ")}`
            : "Choose a framework to score this asset"}
        </p>
        <FrameworkPicker
          frameworks={frameworks.map((f) => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            description: f.description,
          }))}
          selectedId={selectedFrameworkId}
          onSelect={(id) => {
            setSelectedFrameworkId(id);
            setFactorScores({});
          }}
        />
      </div>

      {/* Dynamic factor inputs */}
      {schema && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Score Factors</h3>
          {schema.factors.map((factor) => (
            <div key={factor.slug} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{factor.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">Weight: {(factor.weight * 100).toFixed(0)}%</span>
                </div>
                <span className="text-sm font-mono">
                  {factorScores[factor.slug]?.value ?? "—"} / {factor.range.max}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{factor.description}</p>
              <input
                type="range"
                min={factor.range.min}
                max={factor.range.max}
                step={1}
                value={factorScores[factor.slug]?.value ?? 0}
                onChange={(e) => handleFactorChange(factor.slug, parseInt(e.target.value, 10))}
                className="w-full"
              />
              <input
                type="text"
                placeholder="Optional note for this factor"
                value={factorScores[factor.slug]?.note ?? ""}
                onChange={(e) => handleFactorNote(factor.slug, e.target.value)}
                className="w-full rounded-md border bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}

          {/* Live preview */}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Composite Preview</span>
              <span className="text-lg font-bold font-mono">
                {preview?.toFixed(2) ?? "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Computed server-side on submit</p>
          </div>
        </div>
      )}

      {/* Link research artifact */}
      {researchArtifacts.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="researchLink" className="text-sm font-medium">
            Link Research Artifact <span className="text-muted-foreground">(optional, for provenance)</span>
          </label>
          <select
            id="researchLink"
            value={linkedResearchId}
            onChange={(e) => setLinkedResearchId(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">None</option>
            {researchArtifacts.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending || !selectedFrameworkId}>
          {isPending ? "Saving..." : "Submit Score"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
