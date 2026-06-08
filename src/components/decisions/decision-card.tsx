import Link from "next/link";

interface DecisionCardProps {
  id: string;
  title: string;
  direction: string;
  status: string;
  outcome: string | null;
  createdAt: Date;
}

const DIRECTION_STYLES: Record<string, string> = {
  bullish: "text-green-700 dark:text-green-400",
  bearish: "text-red-700 dark:text-red-400",
  neutral: "text-yellow-700 dark:text-yellow-400",
};

const OUTCOME_STYLES: Record<string, string> = {
  correct: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  incorrect: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export function DecisionCard({ id, title, direction, status, outcome, createdAt }: DecisionCardProps) {
  return (
    <Link
      href={`/decisions/${id}`}
      className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
    >
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${DIRECTION_STYLES[direction] || ""}`}>
          {direction.charAt(0).toUpperCase() + direction.slice(1)}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {outcome && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[outcome] || ""}`}>
            {outcome}
          </span>
        )}
        {status === "open" && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Open
          </span>
        )}
        <span className="text-xs text-muted-foreground">{createdAt.toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
