/**
 * Alert → notification orchestration (DB side-effects).
 *
 * Shared by the price-refresh flow and the cron runner. Evaluates active
 * alerts for one or more assets against their current price and creates a
 * Notification (and stamps lastTriggeredAt) for each newly-triggered alert.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { evaluateAlert, type AlertKind } from "@/lib/alerts/engine";

const RETRIGGER_COOLDOWN_MS = Number(
  process.env.ALERT_COOLDOWN_MS ?? 6 * 60 * 60 * 1000 // 6h
);

export interface TriggeredAlert {
  alertId: string;
  assetTicker: string;
  message: string;
}

/**
 * Evaluate all active alerts for the given ticker against a fresh price.
 * Creates notifications for triggered alerts (respecting a cooldown so the
 * same alert does not spam on every refresh).
 */
export async function evaluateAlertsForAsset(
  assetTicker: string,
  currentPrice: number
): Promise<TriggeredAlert[]> {
  const alerts = await prisma.alert.findMany({
    where: { assetTicker, active: true },
  });

  const triggered: TriggeredAlert[] = [];
  const now = Date.now();

  for (const alert of alerts) {
    const evalResult = evaluateAlert(
      {
        kind: alert.kind as AlertKind,
        threshold: alert.threshold,
        referencePrice: alert.referencePrice,
      },
      currentPrice
    );

    if (!evalResult.triggered) continue;

    // Cooldown: skip if recently triggered.
    if (
      alert.lastTriggeredAt &&
      now - alert.lastTriggeredAt.getTime() < RETRIGGER_COOLDOWN_MS
    ) {
      continue;
    }

    await prisma.$transaction([
      prisma.notification.create({
        data: {
          kind: "alert",
          title: `Alert: ${assetTicker}`,
          body: evalResult.message,
          link: `/assets/${assetTicker}`,
          assetTicker,
          alertId: alert.id,
        },
      }),
      prisma.alert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: new Date() },
      }),
    ]);

    logger.info("Alert triggered", {
      alertId: alert.id,
      assetTicker,
      kind: alert.kind,
      currentPrice,
    });

    triggered.push({
      alertId: alert.id,
      assetTicker,
      message: evalResult.message,
    });
  }

  return triggered;
}

/** Count of unread notifications (for the nav bell badge). */
export async function unreadNotificationCount(): Promise<number> {
  return prisma.notification.count({ where: { readAt: null } });
}
