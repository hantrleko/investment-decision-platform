import { prisma } from "@/lib/db";
import { searchResearch } from "@/lib/search/fts";
import { ResearchCard } from "@/components/research/research-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SearchBar } from "@/components/shared/search-bar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const PAGE_SIZE = 20;

interface ResearchListPageProps {
  q?: string;
  tag?: string;
  page?: number;
}

export async function ResearchList({ q, tag, page = 1 }: ResearchListPageProps) {
  const where = buildWhere(q, tag);
  const skip = (page - 1) * PAGE_SIZE;

  const [artifacts, total] = await (q && q.trim()
    ? searchResearchList(q, tag, skip, PAGE_SIZE)
    : prismaListSearch(where, skip, PAGE_SIZE));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Research Workspace</h1>
        <Link href="/research/new">
          <Button>New Artifact</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SearchBar />
        </div>
        {tag && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by tag:</span>
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
              {tag}
            </span>
            <Link href="/research" className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </Link>
          </div>
        )}
      </div>

      {artifacts.length === 0 ? (
        <EmptyState
          title={q ? "No results found" : "No research artifacts yet"}
          description={
            q
              ? "Try a different search term"
              : "Create your first research artifact to get started"
          }
        />
      ) : (
        <div className="grid gap-3">
          {artifacts.map((a) => (
            <ResearchCard
              key={a.id}
              id={a.id}
              title={a.title}
              tags={a.tags}
              assetTicker={a.assetTicker}
              updatedAt={a.updatedAt}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/research"
        searchParams={{ q, tag }}
      />
    </div>
  );
}

function buildWhere(q?: string, tag?: string) {
  const conditions: object[] = [];

  if (tag) {
    conditions.push({ tags: { contains: tag } });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

async function searchResearchList(q: string, tag: string | undefined, skip: number, take: number) {
  const results = await searchResearch(q, 200);
  let filtered = results;

  if (tag) {
    filtered = results.filter((a) => a.tags.split(",").map((t: string) => t.trim()).includes(tag));
  }

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + take);

  return [paged.map((a) => ({ id: a.id, title: a.title, tags: a.tags, assetTicker: a.assetTicker, updatedAt: a.updatedAt })), total] as const;
}

async function prismaListSearch(where: object, skip: number, take: number) {
  const [artifacts, total] = await Promise.all([
    prisma.researchArtifact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        title: true,
        tags: true,
        assetTicker: true,
        updatedAt: true,
      },
    }),
    prisma.researchArtifact.count({ where }),
  ]);

  return [artifacts, total] as const;
}
