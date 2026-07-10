/**
 * Alert evaluation engine.
 *
 * Pure functions that decide whether an alert condition is met for a given
 * price. Kept side-effect free so they are trivially unit-testable; the
 * DB-touching orchestration lives in the alert actions / cron runner.
 */

export type AlertKind = "price_above" | "price_below" | "pct_change";

export interface AlertRule {
  kind: AlertKind;
  threshold: number;
  referencePrice?: number | null;
}

export interface AlertEvaluation {
  triggered: boolean;
  /** Human-readable explanation for the notification body. */
  message: string;
  /** Observed value that was compared against the threshold. */
  observed: number;
}

const ALERT_KINDS: readonly AlertKind[] = [
  "price_above",
  "price_below",
  "pct_change",
];

export function isAlertKind(value: string): value is AlertKind {
  return (ALERT_KINDS as readonly string[]).includes(value);
}

/**
 * Evaluate an alert against the current price.
 * Returns triggered=false when inputs are insufficient (e.g. pct_change with
 * no reference price) rather than throwing.
 */
export function evaluateAlert(
  rule: AlertRule,
  currentPrice: number
): AlertEvaluation {
  switch (rule.kind) {
    case "price_above": {
      const triggered = currentPrice >= rule.threshold;
      return {
        triggered,
        observed: currentPrice,
        message: `Price ${currentPrice.toFixed(2)} ${
          triggered ? "reached/exceeded" : "is below"
        } target ${rule.threshold.toFixed(2)}`,
      };
    }
    case "price_below": {
      const triggered = currentPrice <= rule.threshold;
      return {
        triggered,
        observed: currentPrice,
        message: `Price ${currentPrice.toFixed(2)} ${
          triggered ? "dropped to/below" : "is above"
        } target ${rule.threshold.toFixed(2)}`,
      };
    }
    case "pct_change": {
      const ref = rule.referencePrice;
      if (ref == null || ref === 0) {
        return {
          triggered: false,
          observed: 0,
          message: "No reference price to compute percent change",
        };
      }
      const pct = ((currentPrice - ref) / ref) * 100;
      // threshold is the absolute percent move that triggers the alert
      const triggered = Math.abs(pct) >= Math.abs(rule.threshold);
      return {
        triggered,
        observed: pct,
        message: `Moved ${pct >= 0 ? "+" : ""}${pct.toFixed(
          2
        )}% from reference ${ref.toFixed(2)} (threshold ±${Math.abs(
          rule.threshold
        ).toFixed(2)}%)`,
      };
    }
  }
}

/** Short label for UI display. */
export function describeAlert(rule: AlertRule): string {
  switch (rule.kind) {
    case "price_above":
      return `Price ≥ ${rule.threshold}`;
    case "price_below":
      return `Price ≤ ${rule.threshold}`;
    case "pct_change":
      return `Moves ±${Math.abs(rule.threshold)}% from ${
        rule.referencePrice?.toFixed(2) ?? "?"
      }`;
  }
}
