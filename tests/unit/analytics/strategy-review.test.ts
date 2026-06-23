import { describe, it, expect } from "vitest";
import {
  computeConversionRate,
  computeStrategySummary,
  computeLevelBreakdown,
  applyFilters,
  type ReviewItem,
  type ReviewFilters,
} from "@/lib/analytics/strategy-review";

// ─── computeConversionRate ─────────────────────────────────────

describe("computeConversionRate", () => {
  it("returns 0 for zero total", () => {
    expect(computeConversionRate(0, 0)).toBe(0);
  });

  it("returns 1 for all converted", () => {
    expect(computeConversionRate(10, 10)).toBe(1);
  });

  it("returns 0.5 for half converted", () => {
    expect(computeConversionRate(10, 5)).toBe(0.5);
  });

  it("returns correct fraction for uneven numbers", () => {
    expect(computeConversionRate(3, 1)).toBeCloseTo(0.3333, 3);
  });
});

// ─── computeStrategySummary ────────────────────────────────────

describe("computeStrategySummary", () => {
  it("handles empty recommendations and decisions", () => {
    const summary = computeStrategySummary("test", "Test", true, [], []);
    expect(summary.totalRecommendations).toBe(0);
    expect(summary.convertedCount).toBe(0);
    expect(summary.conversionRate).toBe(0);
    expect(summary.linkedDecisionsCount).toBe(0);
    expect(summary.closedDecisionsCount).toBe(0);
    expect(summary.correctCount).toBe(0);
    expect(summary.incorrectCount).toBe(0);
    expect(summary.partialCount).toBe(0);
  });

  it("counts total and converted correctly", () => {
    const recs = [
      { id: "r1", convertedDecisionId: "d1" },
      { id: "r2", convertedDecisionId: null },
      { id: "r3", convertedDecisionId: "d2" },
    ];
    const summary = computeStrategySummary("test", "Test", true, recs, []);
    expect(summary.totalRecommendations).toBe(3);
    expect(summary.convertedCount).toBe(2);
    expect(summary.conversionRate).toBeCloseTo(0.6667, 3);
  });

  it("counts closed decisions and outcomes correctly", () => {
    const recs = [
      { id: "r1", convertedDecisionId: "d1" },
      { id: "r2", convertedDecisionId: "d2" },
      { id: "r3", convertedDecisionId: "d3" },
    ];
    const decisions = [
      { id: "d1", status: "closed", outcome: "correct" },
      { id: "d2", status: "closed", outcome: "incorrect" },
      { id: "d3", status: "open", outcome: null },
    ];
    const summary = computeStrategySummary("test", "Test", true, recs, decisions);
    expect(summary.linkedDecisionsCount).toBe(3);
    expect(summary.closedDecisionsCount).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.incorrectCount).toBe(1);
    expect(summary.partialCount).toBe(0);
  });

  it("counts partial outcomes", () => {
    const recs = [{ id: "r1", convertedDecisionId: "d1" }];
    const decisions = [{ id: "d1", status: "closed", outcome: "partial" }];
    const summary = computeStrategySummary("test", "Test", true, recs, decisions);
    expect(summary.partialCount).toBe(1);
    expect(summary.correctCount).toBe(0);
    expect(summary.incorrectCount).toBe(0);
  });

  it("preserves active status", () => {
    const active = computeStrategySummary("test", "Test", true, [], []);
    expect(active.active).toBe(true);
    const inactive = computeStrategySummary("test", "Test", false, [], []);
    expect(inactive.active).toBe(false);
  });
});

// ─── computeLevelBreakdown ─────────────────────────────────────

describe("computeLevelBreakdown", () => {
  it("returns all 6 levels", () => {
    const breakdowns = computeLevelBreakdown([], new Map());
    expect(breakdowns.length).toBe(6);
    expect(breakdowns.map((b) => b.level)).toEqual([
      "Strong Buy", "Buy", "Watch", "Review", "Avoid", "Reject",
    ]);
  });

  it("handles empty data with zeros", () => {
    const breakdowns = computeLevelBreakdown([], new Map());
    for (const b of breakdowns) {
      expect(b.total).toBe(0);
      expect(b.converted).toBe(0);
      expect(b.closed).toBe(0);
      expect(b.correct).toBe(0);
      expect(b.incorrect).toBe(0);
      expect(b.partial).toBe(0);
    }
  });

  it("groups recommendations by level", () => {
    const recs = [
      { recommendation: "Buy", convertedDecisionId: null },
      { recommendation: "Buy", convertedDecisionId: "d1" },
      { recommendation: "Strong Buy", convertedDecisionId: null },
      { recommendation: "Avoid", convertedDecisionId: "d2" },
    ];
    const breakdowns = computeLevelBreakdown(recs, new Map());
    const buy = breakdowns.find((b) => b.level === "Buy");
    expect(buy!.total).toBe(2);
    expect(buy!.converted).toBe(1);

    const strongBuy = breakdowns.find((b) => b.level === "Strong Buy");
    expect(strongBuy!.total).toBe(1);
    expect(strongBuy!.converted).toBe(0);

    const avoid = breakdowns.find((b) => b.level === "Avoid");
    expect(avoid!.total).toBe(1);
    expect(avoid!.converted).toBe(1);
  });

  it("computes outcome distribution per level", () => {
    const recs = [
      { recommendation: "Buy", convertedDecisionId: "d1" },
      { recommendation: "Buy", convertedDecisionId: "d2" },
      { recommendation: "Buy", convertedDecisionId: "d3" },
    ];
    const decisionMap = new Map([
      ["d1", { status: "closed", outcome: "correct" }],
      ["d2", { status: "closed", outcome: "incorrect" }],
      ["d3", { status: "open", outcome: null }],
    ]);
    const breakdowns = computeLevelBreakdown(recs, decisionMap);
    const buy = breakdowns.find((b) => b.level === "Buy");
    expect(buy!.converted).toBe(3);
    expect(buy!.closed).toBe(2);
    expect(buy!.correct).toBe(1);
    expect(buy!.incorrect).toBe(1);
    expect(buy!.partial).toBe(0);
  });

  it("handles missing decision in map gracefully", () => {
    const recs = [
      { recommendation: "Buy", convertedDecisionId: "d-missing" },
    ];
    const breakdowns = computeLevelBreakdown(recs, new Map());
    const buy = breakdowns.find((b) => b.level === "Buy");
    expect(buy!.converted).toBe(1);
    expect(buy!.closed).toBe(0);
    expect(buy!.correct).toBe(0);
  });
});

// ─── applyFilters ──────────────────────────────────────────────

describe("applyFilters", () => {
  const items: ReviewItem[] = [
    {
      id: "r1", strategySlug: "valuation-first", strategyName: "Valuation First",
      assetTicker: "AAPL", assetName: "Apple Inc.", recommendation: "Buy",
      createdAt: new Date(), converted: true, decisionId: "d1",
      decisionStatus: "closed", decisionDirection: "bullish", decisionOutcome: "correct",
      configHistoryId: "h1", experimentLabel: "exp-2026-06",
    },
    {
      id: "r2", strategySlug: "trend-confirmed", strategyName: "Trend Confirmed",
      assetTicker: "NVDA", assetName: "NVIDIA", recommendation: "Strong Buy",
      createdAt: new Date(), converted: false, decisionId: null,
      decisionStatus: null, decisionDirection: null, decisionOutcome: null,
      configHistoryId: "h2", experimentLabel: null,
    },
    {
      id: "r3", strategySlug: "valuation-first", strategyName: "Valuation First",
      assetTicker: "AAPL", assetName: "Apple Inc.", recommendation: "Watch",
      createdAt: new Date(), converted: true, decisionId: "d2",
      decisionStatus: "open", decisionDirection: "neutral", decisionOutcome: null,
      configHistoryId: null, experimentLabel: null,
    },
  ];

  it("returns all items when no filters", () => {
    expect(applyFilters(items, {}).length).toBe(3);
  });

  it("filters by strategy slug", () => {
    const filtered = applyFilters(items, { strategySlug: "valuation-first" });
    expect(filtered.length).toBe(2);
    expect(filtered.every((i) => i.strategySlug === "valuation-first")).toBe(true);
  });

  it("filters by asset ticker", () => {
    const filtered = applyFilters(items, { assetTicker: "AAPL" });
    expect(filtered.length).toBe(2);
    expect(filtered.every((i) => i.assetTicker === "AAPL")).toBe(true);
  });

  it("filters by recommendation level", () => {
    const filtered = applyFilters(items, { recommendationLevel: "Buy" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("filters converted only", () => {
    const filtered = applyFilters(items, { convertedOnly: true });
    expect(filtered.length).toBe(2);
    expect(filtered.every((i) => i.converted)).toBe(true);
  });

  it("filters unconverted only", () => {
    const filtered = applyFilters(items, { unconvertedOnly: true });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r2");
  });

  it("filters by outcome", () => {
    const filtered = applyFilters(items, { outcome: "correct" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("outcome filter excludes unconverted items", () => {
    const filtered = applyFilters(items, { outcome: "incorrect" });
    expect(filtered.length).toBe(0);
  });

  it("combines multiple filters", () => {
    const filtered = applyFilters(items, {
      strategySlug: "valuation-first",
      assetTicker: "AAPL",
      convertedOnly: true,
    });
    expect(filtered.length).toBe(2);
  });

  it("combines filters that result in empty set", () => {
    const filtered = applyFilters(items, {
      strategySlug: "trend-confirmed",
      convertedOnly: true,
    });
    expect(filtered.length).toBe(0);
  });

  it("filters by experiment label", () => {
    const filtered = applyFilters(items, { experimentLabel: "exp-2026-06" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("filters by config history id", () => {
    const filtered = applyFilters(items, { configHistoryId: "h1" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("experiment label filter excludes items without label", () => {
    const filtered = applyFilters(items, { experimentLabel: "nonexistent" });
    expect(filtered.length).toBe(0);
  });

  it("config history id null matches items without history", () => {
    // r3 has configHistoryId: null
    const filtered = applyFilters(items, { configHistoryId: "h2" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r2");
  });

  it("combines experiment label with strategy filter", () => {
    const filtered = applyFilters(items, {
      strategySlug: "valuation-first",
      experimentLabel: "exp-2026-06",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });
});
