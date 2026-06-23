import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-3 inline-flex items-center rounded-md border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
