import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WatchlistToggle } from "@/components/assets/watchlist-toggle";
import { AssetTabs } from "@/components/assets/asset-tabs";
import { ScoreComparison } from "@/components/scoring/score-comparison";
import { RefreshPriceButton } from "@/components/assets/refresh-price-button";
import { ManualPriceForm } from "@/components/assets/manual-price-form";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { ticker } = await params;

  const asset = await prisma.asset.findUnique({
    where: { ticker },
    include: {
      researchArtifacts: {
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      scores: {
        select: {
          id: true,
          compositeScore: true,
          manualOverride: true,
          factorScores: true,
          scoredAt: true,
          framework: { select: { name: true, slug: true } },
        },
        orderBy: { scoredAt: "desc" },
      },
      watchlistEntries: { select: { id: true } },
    },
  });

  if (!asset) {
    notFound();
  }

  const isOnWatchlist = asset.watchlistEntries.length > 0;

  // Decisions linked via research or scores
  const decisionsViaResearch = await prisma.decision.findMany({
    where: {
      researchLinks: { some: { researchArtifact: { assetTicker: ticker } } },
    },
    select: { id: true, title: true, direction: true, status: true, outcome: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const decisionsViaScores = await prisma.decision.findMany({
    where: {
      scoreLinks: { some: { score: { assetTicker: ticker } } },
    },
    select: { id: true, title: true, direction: true, status: true, outcome: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const allDecisionIds = new Set<string>();
  const allDecisions = [...decisionsViaResearch, ...decisionsViaScores].filter((d) => {
    if (allDecisionIds.has(d.id)) return false;
    allDecisionIds.add(d.id);
    return true;
  });

  // Group scores by framework for history view (F7)
  const scoresByFramework = new Map<string, typeof asset.scores>();
  for (const s of asset.scores) {
    const key = s.framework.slug;
    if (!scoresByFramework.has(key)) scoresByFramework.set(key, []);
    scoresByFramework.get(key)!.push(s);
  }

  // Get most recent score per framework for comparison (F8)
  const latestPerFramework = Array.from(scoresByFramework.values())
    .map((scores) => scores[0])
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Asset header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {asset.ticker}
            <span className="ml-2 text-lg font-normal text-muted-foreground">
              {asset.name}
            </span>
          </h1>
          <div className="mt-1 flex gap-3 text-sm text-muted-foreground">
            {asset.sector && <span>{asset.sector}</span>}
            <span>{asset.assetType}</span>
            {asset.exchange && <span>{asset.exchange}</span>}
          </div>
          {asset.notes && <p className="mt-2 text-sm">{asset.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <RefreshPriceButton
            ticker={ticker}
            currentPrice={asset.lastPrice}
            currentPriceTs={asset.lastPriceTs?.toISOString() ?? null}
            currentSource={asset.priceSource}
          />
          <ManualPriceForm ticker={ticker} />
          <div className="flex gap-2">
            <Link href={`/scores/new?asset=${ticker}`}>
              <Button size="sm">Score with Framework</Button>
            </Link>
            <WatchlistToggle assetTicker={ticker} isOnWatchlist={isOnWatchlist} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Side-by-side comparison (F8) */}
      {latestPerFramework.length >= 2 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Score Comparison</h2>
          <ScoreComparison
            scores={latestPerFramework.map((s) => ({
              frameworkName: s.framework.name,
              compositeScore: s.compositeScore,
              manualOverride: s.manualOverride,
              factorScores: s.factorScores,
              scoredAt: s.scoredAt,
            }))}
          />
        </section>
      )}

      <Separator />

      {/* Hub tabs */}
      <AssetTabs
        ticker={ticker}
        research={asset.researchArtifacts.map((r) => ({
          id: r.id,
          title: r.title,
          updatedAt: r.updatedAt,
        }))}
        scores={asset.scores.map((s) => ({
          id: s.id,
          compositeScore: s.compositeScore,
          manualOverride: s.manualOverride,
          framework: s.framework,
          scoredAt: s.scoredAt,
        }))}
        decisions={allDecisions.map((d) => ({
          id: d.id,
          title: d.title,
          direction: d.direction,
          status: d.status,
          outcome: d.outcome,
          createdAt: d.createdAt,
        }))}
      />
    </div>
  );
}
