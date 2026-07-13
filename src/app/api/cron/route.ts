import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAssetMetaAndPrice } from "@/lib/marketdata/yahoo";
import { evaluateAlertsForAsset } from "@/lib/alerts/notify";
import { logger } from "@/lib/logger";

/**
 * Scheduled job runner.
 *
 * Intended to be invoked by an external scheduler (system cron, Railway cron,
 * GitHub Actions, or an uptime pinger). Refreshes prices for every asset that
 * has an active alert or a watchlist entry, evaluates alerts, and generates
 * notifications.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * If CRON_SECRET is unset, the endpoint is disabled (returns 503) to avoid an
 * unauthenticated open endpoint in production.
 *
 *   Example crontab (every 15 min):
 *   0,15,30,45 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *       https://your-app/api/cron > /dev/null
 */

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Require a non-empty secret of at least 16 characters to prevent trivially
  // weak or accidentally whitespace-only values from enabling the endpoint.
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function runJob() {
  // Collect tickers that need refreshing: active alerts + watchlist.
  const [alerted, watched] = await Promise.all([
    prisma.alert.findMany({
      where: { active: true },
      select: { assetTicker: true },
      distinct: ["assetTicker"],
    }),
    prisma.watchlistEntry.findMany({
      select: { assetTicker: true },
    }),
  ]);

  const tickers = Array.from(
    new Set([
      ...alerted.map((a) => a.assetTicker),
      ...watched.map((w) => w.assetTicker),
    ])
  );

  const summary = {
    scanned: tickers.length,
    priced: 0,
    failed: 0,
    triggered: 0,
  };

  for (const ticker of tickers) {
    try {
      const meta = await getAssetMetaAndPrice(ticker);
      if (meta.lastPrice == null) {
        summary.failed++;
        continue;
      }
      await prisma.asset.update({
        where: { ticker },
        data: {
          lastPrice: meta.lastPrice,
          lastPriceTs: new Date(),
          priceSource: "yahoo",
        },
      });
      summary.priced++;

      const triggered = await evaluateAlertsForAsset(ticker, meta.lastPrice);
      summary.triggered += triggered.length;
    } catch (err) {
      summary.failed++;
      logger.warn("Cron price refresh failed", { ticker, error: err });
    }
  }

  return summary;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    const secret = process.env.CRON_SECRET?.trim();
    const disabled = !secret || secret.length < 16;
    return NextResponse.json(
      {
        error: disabled
          ? "Cron disabled: set CRON_SECRET to enable"
          : "Unauthorized",
      },
      { status: disabled ? 503 : 401 }
    );
  }

  const startedAt = Date.now();
  try {
    const summary = await runJob();
    const durationMs = Date.now() - startedAt;
    logger.info("Cron job completed", { ...summary, durationMs });

    // Record a run notification if anything triggered.
    if (summary.triggered > 0) {
      await prisma.notification.create({
        data: {
          kind: "job",
          title: "Scheduled scan complete",
          body: `${summary.triggered} alert(s) triggered across ${summary.priced} priced asset(s).`,
          link: "/notifications",
        },
      });
    }

    return NextResponse.json({ ...summary, durationMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron job failed";
    logger.error("Cron job failed", { error: err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow GET for simple pingers that cannot send POST.
export async function GET(request: Request) {
  return POST(request);
}
