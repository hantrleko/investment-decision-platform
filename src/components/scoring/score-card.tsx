import Link from "next/link";

interface ScoreCardProps {
  id: string;
  frameworkName: string;
  compositeScore: number | null;
  manualOverride: boolean;
  scoredAt: Date;
}

export function ScoreCard({ id, frameworkName, compositeScore, manualOverride, scoredAt }: ScoreCardProps) {
  return (
    <Link
      href={`/scores/${id}`}
      className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
    >
      <div>
        <span className="text-sm font-medium">{frameworkName}</span>
        {manualOverride && (
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            Override
          </span>
        )}
      </div>
      <div className="text-right">
        <span className="text-sm font-mono">{compositeScore?.toFixed(2) ?? "—"}</span>
        <p className="text-xs text-muted-foreground">{scoredAt.toLocaleDateString()}</p>
      </div>
    </Link>
  );
}
