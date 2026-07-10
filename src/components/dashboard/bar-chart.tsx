/**
 * Dependency-free horizontal bar chart for categorical distributions
 * (e.g. sector allocation, recommendation levels). Server-renderable.
 */
export interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary text shown on the right (e.g. "$1,234"). */
  display?: string;
}

export function BarChart({
  data,
  emptyLabel = "No data",
}: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate" title={d.label}>
              {d.label}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary transition-all"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
              {d.display ?? d.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
