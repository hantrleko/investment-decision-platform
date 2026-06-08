import Link from "next/link";
import { EntityBadge } from "@/components/shared/entity-badge";

interface ResearchCardProps {
  id: string;
  title: string;
  tags: string;
  assetTicker: string | null;
  updatedAt: Date;
}

export function ResearchCard({ id, title, tags, assetTicker, updatedAt }: ResearchCardProps) {
  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <Link
      href={`/research/${id}`}
      className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{title}</h3>
        <time className="shrink-0 text-xs text-muted-foreground">
          {updatedAt.toLocaleDateString()}
        </time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {assetTicker && (
          <EntityBadge href={`/assets/${assetTicker}`} label={assetTicker} variant="asset" />
        )}
        {tagList.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
