import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/sparkline";
import {
  computeDecisionStats,
  countByLevel,
  computeHitRateTrend,
} from "@/lib/analytics/dashboard";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-colors hover:ring-foreground/20">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  const [
    assetCount,
    researchCount,
    scoreCount,
    watchlistCount,
    activeAlertCount,
    decisions,
    recommendations,
    recentRecs,
    recentNotifications,
    topMovers,
  ] = await Promise.all([
    prisma.asset.count(),
    prisma.researchArtifact.count(),
    prisma.score.count(),
    prisma.watchlistEntry.count(),
    prisma.alert.count({ where: { active: true } }),
    prisma.decision.findMany({
      select: { status: true, outcome: true, outcomeDate: true },
    }),
    prisma.recommendation.findMany({ select: { recommendation: true } }),
    prisma.recommendation.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.asset.findMany({
      where: { lastPrice: { not: null } },
      orderBy: { lastPriceTs: "desc" },
      take: 6,
      select: {
        ticker: true,
        name: true,
        lastPrice: true,
        lastPriceTs: true,
      },
    }),
  ]);

  const stats = computeDecisionStats(decisions);
  const levels = countByLevel(recommendations);
  const trend = computeHitRateTrend(
    decisions.map((d) => ({ outcomeDate: d.outcomeDate, outcome: d.outcome }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex gap-2 text-sm">
          <a
            href="/api/export/decisions"
            className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
          >
            Export decisions
          </a>
          <a
            href="/api/export/recommendations"
            className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
          >
            Export recommendations
          </a>
        </div>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Assets" value={assetCount} href="/assets" />
        <StatCard label="Research" value={researchCount} href="/research" />
        <StatCard label="Scores" value={scoreCount} href="/scores" />
        <StatCard
          label="Decisions"
          value={stats.total}
          sub={`${stats.open} open · ${stats.closed} closed`}
          href="/decisions"
        />
        <StatCard
          label="Hit Rate"
          value={`${stats.hitRatePct}%`}
          sub={`${stats.correct}✓ ${stats.incorrect}✗ ${stats.partial}~`}
        />
        <StatCard
          label="Active Alerts"
          value={activeAlertCount}
          sub={`${watchlistCount} watched`}
          href="/alerts"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hit-rate trend */}
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline points={trend.map((t) => t.hitRatePct)} />
            <p className="mt-2 text-xs text-muted-foreground">
              {trend.length > 0
                ? `Across ${trend.length} resolved decision(s). Dashed line = 50%.`
                : "Resolve decisions with outcomes to see the trend."}
            </p>
          </CardContent>
        </Card>

        {/* Recommendation distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Recommendation Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recommendations generated yet.
              </p>
            ) : (
              <div className="space-y-2">
                {levels.map((l) => {
                  const total = recommendations.length || 1;
                  const pct = (l.count / total) * 100;
                  return (
                    <div key={l.level} className="flex items-center gap-3">
                      <span className="w-24 text-sm">{l.level}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm tabular-nums">
                        {l.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRecs.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              recentRecs.map((r) => (
                <Link
                  key={r.id}
                  href={`/recommendations/${r.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{r.assetTicker}</span>
                  <span className="text-muted-foreground">
                    {r.recommendation}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recently priced */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Priced</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topMovers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No priced assets.</p>
            ) : (
              topMovers.map((a) => (
                <Link
                  key={a.ticker}
                  href={`/assets/${a.ticker}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{a.ticker}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {a.lastPrice?.toFixed(2)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to report.
              </p>
            ) : (
              recentNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    n.readAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                </div>
              ))
            )}
            <Link
              href="/notifications"
              className="block pt-1 text-xs text-primary hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
