interface ScoreComparisonProps {
  scores: Array<{
    frameworkName: string;
    compositeScore: number | null;
    manualOverride: boolean;
    factorScores: string;
    scoredAt: Date;
  }>;
}

interface ParsedFactor {
  slug: string;
  label: string;
  weight: number;
}

export function ScoreComparison({ scores }: ScoreComparisonProps) {
  if (scores.length < 2) return null;

  // Collect all factor slugs across scores
  const allSlugs = new Set<string>();
  const parsedScores = scores.map((s) => {
    const factors: Record<string, { value: number; note?: string }> = JSON.parse(s.factorScores);
    Object.keys(factors).forEach((slug) => allSlugs.add(slug));
    return { ...s, factors };
  });

  const slugs = Array.from(allSlugs);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Factor</th>
            {parsedScores.map((s, i) => (
              <th key={i} className="pb-2 px-2 font-medium text-center">
                {s.frameworkName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slugs.map((slug) => (
            <tr key={slug} className="border-b last:border-0">
              <td className="py-1.5 pr-4 text-muted-foreground">{slug.replace(/_/g, " ")}</td>
              {parsedScores.map((s, i) => (
                <td key={i} className="py-1.5 px-2 text-center font-mono">
                  {s.factors[slug]?.value ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 font-medium">
            <td className="py-1.5 pr-4">Composite</td>
            {parsedScores.map((s, i) => (
              <td key={i} className="py-1.5 px-2 text-center font-mono">
                {s.manualOverride ? `${s.compositeScore?.toFixed(2)}*` : s.compositeScore?.toFixed(2) ?? "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted-foreground">* Manually overridden</p>
    </div>
  );
}
