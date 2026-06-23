import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ConvertToDecisionButton } from "@/components/strategies/convert-to-decision-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

const REC_STYLES: Record<string, string> = {
  "Strong Buy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Buy: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  Watch: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Avoid: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Reject: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
};

export default async function RecommendationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const rec = await prisma.recommendation.findUnique({
    where: { id },
    include: {
      asset: { select: { ticker: true, name: true } },
      author: { select: { name: true, email: true } },
    },
  });

  if (!rec) {
    notFound();
  }

  const inputSignals: Array<{ signal: string; value: string }> = JSON.parse(rec.inputSignals);
  const rulesTriggered: Array<{ rule: string; detail: string }> = JSON.parse(rec.rulesTriggered);
  const scoreIds: string[] = JSON.parse(rec.scoreIds);
  const researchIds: string[] = JSON.parse(rec.researchIds);

  // Fetch linked scores and research
  const linkedScores = scoreIds.length > 0
    ? await prisma.score.findMany({
        where: { id: { in: scoreIds } },
        select: {
          id: true,
          compositeScore: true,
          manualOverride: true,
          framework: { select: { name: true, slug: true } },
          scoredAt: true,
        },
      })
    : [];

  const linkedResearch = researchIds.length > 0
    ? await prisma.researchArtifact.findMany({
        where: { id: { in: researchIds } },
        select: { id: true, title: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{rec.strategyName}</h1>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${REC_STYLES[rec.recommendation] || ""}`}>
            {rec.recommendation}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <Link href={`/assets/${rec.assetTicker}`} className="text-primary hover:underline">
            {rec.assetTicker}
          </Link>
          {" — "}
          {rec.asset.name}
          {" · "}
          {rec.createdAt.toLocaleString()}
          {" · "}
          By {rec.author.name || rec.author.email}
        </p>
      </div>

      {/* Reasoning */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Reasoning</h2>
        <div className="rounded-md border p-4 text-sm whitespace-pre-wrap">{rec.reasoning}</div>
      </section>

      <Separator />

      {/* Input Signals */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Input Signals</h2>
        {inputSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signals recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Signal</th>
                <th className="pb-2 font-medium font-mono">Value</th>
              </tr>
            </thead>
            <tbody>
              {inputSignals.map((sig, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">{sig.signal}</td>
                  <td className="py-1.5 font-mono">{sig.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Separator />

      {/* Rules Triggered */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Rules Triggered</h2>
        {rulesTriggered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules triggered.</p>
        ) : (
          <div className="space-y-2">
            {rulesTriggered.map((rule, i) => (
              <div key={i} className="rounded-md border p-3">
                <p className="text-sm font-mono text-muted-foreground">{rule.rule}</p>
                <p className="mt-1 text-sm">{rule.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Linked Scores */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Linked Scores</h2>
        {linkedScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores linked.</p>
        ) : (
          <div className="space-y-2">
            {linkedScores.map((s) => (
              <Link
                key={s.id}
                href={`/scores/${s.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
              >
                <span className="text-sm font-medium">{s.framework.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {s.manualOverride ? "Override" : s.compositeScore?.toFixed(2) ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.scoredAt.toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Linked Research */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Linked Research</h2>
        {linkedResearch.length === 0 ? (
          <p className="text-sm text-muted-foreground">No research artifacts linked.</p>
        ) : (
          <div className="space-y-2">
            {linkedResearch.map((r) => (
              <Link
                key={r.id}
                href={`/research/${r.id}`}
                className="block rounded-md border p-3 hover:bg-accent/50"
              >
                <span className="text-sm font-medium">{r.title}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Convert to Decision */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Decision Integration</h2>
        <ConvertToDecisionButton
          recommendationId={rec.id}
          alreadyConverted={!!rec.convertedDecisionId}
          convertedDecisionId={rec.convertedDecisionId ?? undefined}
        />
      </section>
    </div>
  );
}
