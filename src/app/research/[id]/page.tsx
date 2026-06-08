import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EntityBadge } from "@/components/shared/entity-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteResearchButton } from "@/components/research/delete-research-button";
import { AttachmentsSection } from "@/components/research/attachments-section";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResearchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  const artifact = await prisma.researchArtifact.findUnique({
    where: { id },
    include: {
      asset: { select: { ticker: true, name: true } },
      author: { select: { id: true, name: true, email: true } },
      scores: {
        select: {
          id: true,
          compositeScore: true,
          manualOverride: true,
          framework: { select: { name: true, slug: true } },
          scoredAt: true,
        },
      },
      decisions: {
        select: {
          decisionId: true,
          decision: {
            select: { id: true, title: true, direction: true, status: true },
          },
        },
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!artifact) {
    notFound();
  }

  const tagList = artifact.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {artifact.assetTicker && (
              <EntityBadge
                href={`/assets/${artifact.assetTicker}`}
                label={`${artifact.assetTicker}${artifact.asset?.name ? ` — ${artifact.asset.name}` : ""}`}
                variant="asset"
              />
            )}
            {tagList.map((tag, i) => (
              <Link
                key={i}
                href={`/research?tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground hover:opacity-80"
              >
                {tag}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Created {artifact.createdAt.toLocaleDateString()} · Updated {artifact.updatedAt.toLocaleDateString()}
            {artifact.author && ` · By ${artifact.author.name || artifact.author.email}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/research/${id}/edit`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <DeleteResearchButton
            id={id}
            linkedScores={artifact.scores.length}
            linkedDecisions={artifact.decisions.length}
          />
        </div>
      </div>

      <Separator />

      <div className="prose prose-sm max-w-none dark:prose-invert">
        {artifact.contentType === "rich-text" ? (
          <RichTextRenderer content={artifact.content} />
        ) : (
          <div className="whitespace-pre-wrap">{artifact.content}</div>
        )}
      </div>

      <Separator />

      <AttachmentsSection
        researchArtifactId={id}
        attachments={artifact.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSizeBytes: a.fileSizeBytes,
        }))}
      />

      <Separator />
      <section>
        <h2 className="text-lg font-semibold">Linked Scores</h2>
        {artifact.scores.length === 0 ? (
          <EmptyState
            title="No linked scores"
            description="Scores linked to this research will appear here when created."
          />
        ) : (
          <div className="mt-2 space-y-2">
            {artifact.scores.map((s) => (
              <Link
                key={s.id}
                href={`/scores/${s.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <EntityBadge
                  href={`/scores/${s.id}`}
                  label={s.framework.name}
                  variant="score"
                />
                <span className="text-sm font-mono">
                  {s.manualOverride ? "Override" : s.compositeScore?.toFixed(2) ?? "—"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Linked Decisions — AC-R10: minimal rendering */}
      <section>
        <h2 className="text-lg font-semibold">Linked Decisions</h2>
        {artifact.decisions.length === 0 ? (
          <EmptyState
            title="No linked decisions"
            description="Decisions referencing this research will appear here when created."
          />
        ) : (
          <div className="mt-2 space-y-2">
            {artifact.decisions.map((d) => (
              <Link
                key={d.decisionId}
                href={`/decisions/${d.decision.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <span className="text-sm font-medium">{d.decision.title}</span>
                <span className="text-xs text-muted-foreground">
                  {d.decision.direction} · {d.decision.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RichTextRenderer({ content }: { content: string }) {
  try {
    const doc = JSON.parse(content);
    return (
      <div
        dangerouslySetInnerHTML={{
          __html: renderDocToHtml(doc),
        }}
      />
    );
  } catch {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
}

function renderDocToHtml(doc: Record<string, unknown>): string {
  if (!doc || !doc.content) return "";
  return (doc.content as Array<Record<string, unknown>>)
    .map(renderNode)
    .join("");
}

function renderNode(node: Record<string, unknown>): string {
  const type = node.type as string;

  switch (type) {
    case "heading": {
      const level = (node.attrs as Record<string, number>)?.level || 2;
      const inner = renderInline(node);
      return `<h${level}>${inner}</h${level}>`;
    }
    case "paragraph":
      return `<p>${renderInline(node)}</p>`;
    case "bulletList":
      return `<ul>${renderListItems(node)}</ul>`;
    case "orderedList":
      return `<ol>${renderListItems(node)}</ol>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${renderChildrenText(node)}</code></pre>`;
    case "hardBreak":
      return "<br>";
    default:
      return renderInline(node);
  }
}

function renderInline(node: Record<string, unknown>): string {
  if (!node.content) return "";
  return (node.content as Array<Record<string, unknown>>)
    .map((n) => {
      if (n.type === "text") {
        const text = (n as Record<string, unknown>).text as string;
        const marks = (n as Record<string, unknown>).marks as Array<Record<string, unknown>> | undefined;
        let html = escapeHtml(text);
        if (marks) {
          for (const mark of marks) {
            const markType = mark.type as string;
            if (markType === "bold") html = `<strong>${html}</strong>`;
            else if (markType === "italic") html = `<em>${html}</em>`;
            else if (markType === "code") html = `<code>${html}</code>`;
            else if (markType === "link") {
              const href = (mark.attrs as Record<string, string>)?.href || "#";
              html = `<a href="${escapeHtml(href)}" class="text-primary underline">${html}</a>`;
            }
          }
        }
        return html;
      }
      return renderNode(n);
    })
    .join("");
}

function renderChildren(node: Record<string, unknown>): string {
  if (!node.content) return "";
  return (node.content as Array<Record<string, unknown>>).map(renderNode).join("");
}

function renderListItems(node: Record<string, unknown>): string {
  if (!node.content) return "";
  return (node.content as Array<Record<string, unknown>>)
    .map((item) => `<li>${renderInline(item)}</li>`)
    .join("");
}

function renderChildrenText(node: Record<string, unknown>): string {
  if (!node.content) return "";
  return (node.content as Array<Record<string, unknown>>)
    .map((n) => {
      if (n.type === "text") return escapeHtml((n as Record<string, unknown>).text as string);
      return renderChildrenText(n);
    })
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
