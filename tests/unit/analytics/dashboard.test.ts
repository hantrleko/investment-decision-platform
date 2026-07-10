import { describe, it, expect } from "vitest";
import {
  computeDecisionStats,
  countByLevel,
  computeHitRateTrend,
} from "@/lib/analytics/dashboard";

describe("dashboard analytics", () => {
  it("computes decision stats and hit rate (partial = 0.5)", () => {
    const stats = computeDecisionStats([
      { status: "closed", outcome: "correct" },
      { status: "closed", outcome: "incorrect" },
      { status: "closed", outcome: "partial" },
      { status: "open", outcome: null },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.open).toBe(1);
    expect(stats.closed).toBe(3);
    // scored = 3, (1 + 0.5) / 3 = 50%
    expect(stats.hitRatePct).toBe(50);
  });

  it("returns 0 hit rate when nothing scored", () => {
    const stats = computeDecisionStats([{ status: "open", outcome: null }]);
    expect(stats.hitRatePct).toBe(0);
  });

  it("counts recommendations by level in display order", () => {
    const result = countByLevel([
      { recommendation: "Buy" },
      { recommendation: "Strong Buy" },
      { recommendation: "Buy" },
      { recommendation: "Reject" },
    ]);
    expect(result[0]).toEqual({ level: "Strong Buy", count: 1 });
    expect(result[1]).toEqual({ level: "Buy", count: 2 });
    expect(result[result.length - 1]).toEqual({ level: "Reject", count: 1 });
  });

  it("computes a cumulative hit-rate trend ordered by outcome date", () => {
    const trend = computeHitRateTrend([
      { outcomeDate: new Date("2024-03-01"), outcome: "correct" },
      { outcomeDate: new Date("2024-01-01"), outcome: "incorrect" },
      { outcomeDate: new Date("2024-02-01"), outcome: "correct" },
      { outcomeDate: null, outcome: "correct" }, // excluded (no date)
    ]);
    expect(trend).toHaveLength(3);
    // ordered: incorrect(0/1=0), correct(1/2=50), correct(2/3=66.7)
    expect(trend[0].hitRatePct).toBe(0);
    expect(trend[1].hitRatePct).toBe(50);
    expect(trend[2].hitRatePct).toBe(66.7);
    expect(trend[2].n).toBe(3);
  });
});
