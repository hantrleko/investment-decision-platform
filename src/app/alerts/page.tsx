import { prisma } from "@/lib/db";
import { AlertManager } from "@/components/alerts/alert-manager";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [alerts, assets] = await Promise.all([
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { name: true, lastPrice: true } } },
    }),
    prisma.asset.findMany({
      select: { ticker: true, name: true, lastPrice: true },
      orderBy: { ticker: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Get notified when an asset crosses a price target or moves beyond a
          percentage threshold. Alerts are evaluated on price refresh and by the
          scheduled scan.
        </p>
      </div>
      <AlertManager
        assets={assets}
        alerts={alerts.map((a) => ({
          id: a.id,
          assetTicker: a.assetTicker,
          assetName: a.asset.name,
          kind: a.kind,
          threshold: a.threshold,
          referencePrice: a.referencePrice,
          note: a.note,
          active: a.active,
          lastPrice: a.asset.lastPrice,
          lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
