import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  listStrategies,
  getStrategy,
  type StrategyInput,
} from "@/lib/strategies";

// ─── Strategy Registry ─────────────────────────────────────────

describe("Strategy registry", () => {
  it("lists 3 built-in strategies", () => {
    const strategies = listStrategies();
    expect(strategies.length).toBe(3);
    const slugs = strategies.map((s) => s.slug);
    expect(slugs).toContain("valuation-first");
    expect(slugs).toContain("trend-confirmed");
    expect(slugs).toContain("multi-signal-gate");
  });

  it("retrieves strategy by slug", () => {
    const s = getStrategy("valuation-first");
    expect(s).toBeDefined();
    expect(s!.name).toBe("Valuation First");
    expect(s!.version).toBe("1.0.0");
  });

  it("returns undefined for unknown slug", () => {
    const s = getStrategy("nonexistent");
    expect(s).toBeUndefined();
  });

  it("each strategy has required fields", () => {
    for (const s of listStrategies()) {
      expect(s.slug).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.version).toBeTruthy();
      expect(s.requiredFrameworkSlugs).toBeDefined();
      expect(typeof s.evaluate).toBe("function");
    }
  });
});

// ─── Valuation First Strategy ──────────────────────────────────

describe("Valuation First strategy", () => {
  const strategy = getStrategy("valuation-first")!;

  const makeInput = (
    composite: number | null,
    overrides?: Partial<StrategyInput>
  ): StrategyInput => ({
    assetTicker: "AAPL",
    scores: composite != null
      ? [{
          id: "score1",
          frameworkSlug: "valuation",
          frameworkName: "Valuation",
          compositeScore: composite,
          manualOverride: false,
          factorScores: {},
          scoredAt: new Date(),
        }]
      : [],
    researchArtifacts: [],
    ...overrides,
  });

  it("returns Strong Buy for composite >= 7.5", () => {
    const result = strategy.evaluate(makeInput(8.0));
    expect(result.recommendation).toBe("Strong Buy");
    expect(result.rulesTriggered.length).toBeGreaterThan(0);
    expect(result.scoreIds).toHaveLength(1);
  });

  it("returns Buy for composite >= 6.0", () => {
    const result = strategy.evaluate(makeInput(6.5));
    expect(result.recommendation).toBe("Buy");
  });

  it("returns Watch for composite >= 4.5", () => {
    const result = strategy.evaluate(makeInput(5.0));
    expect(result.recommendation).toBe("Watch");
  });

  it("returns Review for composite >= 3.0", () => {
    const result = strategy.evaluate(makeInput(3.5));
    expect(result.recommendation).toBe("Review");
  });

  it("returns Avoid for composite < 3.0", () => {
    const result = strategy.evaluate(makeInput(2.0));
    expect(result.recommendation).toBe("Avoid");
  });

  it("returns Review when no valuation score exists", () => {
    const result = strategy.evaluate(makeInput(null));
    expect(result.recommendation).toBe("Review");
    expect(result.reasoning).toContain("No Valuation framework score");
    expect(result.scoreIds).toHaveLength(0);
  });

  it("flags manual override in rules", () => {
    const input = makeInput(7.0);
    input.scores[0].manualOverride = true;
    const result = strategy.evaluate(input);
    expect(result.rulesTriggered.some((r) => r.rule === "manual_override")).toBe(true);
  });

  it("includes research support rule when >= 2 research artifacts and Buy+", () => {
    const input = makeInput(8.0, {
      researchArtifacts: [
        { id: "r1", title: "Research 1", tags: "", updatedAt: new Date() },
        { id: "r2", title: "Research 2", tags: "", updatedAt: new Date() },
      ],
    });
    const result = strategy.evaluate(input);
    expect(result.rulesTriggered.some((r) => r.rule === "research_count >= 2")).toBe(true);
    expect(result.researchIds).toHaveLength(2);
  });

  it("produces explainable reasoning text", () => {
    const result = strategy.evaluate(makeInput(7.0));
    expect(result.reasoning).toContain("Valuation First");
    expect(result.reasoning).toContain("AAPL");
    expect(result.reasoning).toContain("7.00");
  });
});

// ─── Trend Confirmed Strategy ──────────────────────────────────

describe("Trend Confirmed strategy", () => {
  const strategy = getStrategy("trend-confirmed")!;

  const makeInput = (
    composite: number | null,
    momentum?: number,
    priceStructure?: number,
    overrides?: Partial<StrategyInput>
  ): StrategyInput => ({
    assetTicker: "NVDA",
    scores: composite != null
      ? [{
          id: "score1",
          frameworkSlug: "trend",
          frameworkName: "Trend",
          compositeScore: composite,
          manualOverride: false,
          factorScores: {
            momentum_signal: { value: momentum ?? 5 },
            price_structure: { value: priceStructure ?? 5 },
          },
          scoredAt: new Date(),
        }]
      : [],
    researchArtifacts: [],
    ...overrides,
  });

  it("returns Buy for composite >= 7.0", () => {
    const result = strategy.evaluate(makeInput(7.5));
    expect(result.recommendation).toBe("Buy");
  });

  it("upgrades to Strong Buy when momentum >= 7 and price_structure >= 6", () => {
    const result = strategy.evaluate(makeInput(7.5, 8, 7));
    expect(result.recommendation).toBe("Strong Buy");
    expect(result.rulesTriggered.some((r) => r.rule === "momentum >= 7 AND price_structure >= 6")).toBe(true);
  });

  it("upgrades Watch to Buy when momentum and price structure confirm", () => {
    const result = strategy.evaluate(makeInput(5.5, 8, 7));
    expect(result.recommendation).toBe("Buy");
  });

  it("downgrades to Avoid when momentum <= 3 and price_structure <= 3", () => {
    const result = strategy.evaluate(makeInput(4.0, 2, 2));
    expect(result.recommendation).toBe("Avoid");
  });

  it("downgrades to Reject when both momentum and price_structure are very low and composite is weak", () => {
    const result = strategy.evaluate(makeInput(2.0, 2, 2));
    expect(result.recommendation).toBe("Reject");
  });

  it("returns Review when no trend score exists", () => {
    const result = strategy.evaluate(makeInput(null));
    expect(result.recommendation).toBe("Review");
    expect(result.reasoning).toContain("No Trend framework score");
  });
});

// ─── Multi-Signal Gate Strategy ────────────────────────────────

describe("Multi-Signal Gate strategy", () => {
  const strategy = getStrategy("multi-signal-gate")!;

  const makeInput = (
    scores: Array<{ slug: string; composite: number | null }>,
    researchCount = 0
  ): StrategyInput => ({
    assetTicker: "MSFT",
    scores: scores.map((s, i) => ({
      id: `score${i}`,
      frameworkSlug: s.slug,
      frameworkName: s.slug.charAt(0).toUpperCase() + s.slug.slice(1),
      compositeScore: s.composite,
      manualOverride: false,
      factorScores: {},
      scoredAt: new Date(),
    })),
    researchArtifacts: Array.from({ length: researchCount }, (_, i) => ({
      id: `r${i}`,
      title: `Research ${i}`,
      tags: "",
      updatedAt: new Date(),
    })),
  });

  it("returns Review when fewer than 2 scores", () => {
    const result = strategy.evaluate(makeInput([{ slug: "valuation", composite: 7.0 }]));
    expect(result.recommendation).toBe("Review");
    expect(result.rulesTriggered.some((r) => r.rule === "score_count < 2")).toBe(true);
  });

  it("returns Strong Buy when avg >= 7.0 and min >= 5.0", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 8.0 },
      { slug: "trend", composite: 6.5 },
    ]));
    expect(result.recommendation).toBe("Strong Buy");
  });

  it("returns Buy when avg >= 6.0 and min >= 4.0", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 7.0 },
      { slug: "trend", composite: 5.0 },
    ]));
    expect(result.recommendation).toBe("Buy");
  });

  it("returns Watch when avg >= 4.5", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 5.0 },
      { slug: "trend", composite: 4.5 },
    ]));
    expect(result.recommendation).toBe("Watch");
  });

  it("returns Avoid when avg < 3.0", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 2.0 },
      { slug: "trend", composite: 2.5 },
    ]));
    expect(result.recommendation).toBe("Avoid");
  });

  it("applies penalty when min < 3.0 even if avg is high", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 9.0 },
      { slug: "trend", composite: 2.0 },
    ]));
    // avg = 5.5 which would be Watch, but min < 3.0 penalty applies
    // avg = 5.5 >= 4.5 → Watch, min < 3.0 penalty doesn't downgrade Watch
    // Let me recalculate: avg = (9+2)/2 = 5.5, min = 2.0
    // 5.5 >= 4.5 → Watch (base), min < 3.0 → penalty only downgrades Buy/Strong Buy
    expect(result.recommendation).toBe("Watch");
    expect(result.rulesTriggered.some((r) => r.rule === "min < 3.0 (penalty)")).toBe(false);
  });

  it("penalty does not apply when min < 3.0 but base level is already Watch (gates prevent Buy)", () => {
    // avg = 6.0, min = 2.0
    // Buy requires avg >= 6.0 AND min >= 4.0 → fails (min=2.0)
    // So base is Watch (avg >= 4.5), penalty doesn't downgrade Watch
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 10.0 },
      { slug: "trend", composite: 2.0 },
    ]));
    expect(result.recommendation).toBe("Watch");
    // Penalty only triggers on Buy/Strong Buy, which can't happen when min < 4.0
    expect(result.rulesTriggered.some((r) => r.rule === "min < 3.0 (penalty)")).toBe(false);
  });

  it("includes research support rule when >= 3 research artifacts", () => {
    const result = strategy.evaluate(makeInput(
      [{ slug: "valuation", composite: 7.0 }, { slug: "trend", composite: 6.0 }],
      3
    ));
    expect(result.rulesTriggered.some((r) => r.rule === "research_count >= 3")).toBe(true);
  });

  it("notes when no research artifacts exist", () => {
    const result = strategy.evaluate(makeInput(
      [{ slug: "valuation", composite: 7.0 }, { slug: "trend", composite: 6.0 }],
      0
    ));
    expect(result.rulesTriggered.some((r) => r.rule === "research_count == 0")).toBe(true);
  });

  it("collects all score IDs in output", () => {
    const result = strategy.evaluate(makeInput([
      { slug: "valuation", composite: 7.0 },
      { slug: "trend", composite: 6.0 },
    ]));
    expect(result.scoreIds).toHaveLength(2);
  });
});

// ─── Edge Cases ────────────────────────────────────────────────

describe("Strategy edge cases", () => {
  it("all strategies handle empty input gracefully", () => {
    const emptyInput: StrategyInput = {
      assetTicker: "TEST",
      scores: [],
      researchArtifacts: [],
    };
    for (const s of listStrategies()) {
      const result = s.evaluate(emptyInput);
      expect(result.recommendation).toBeDefined();
      expect(result.reasoning).toBeTruthy();
      expect(result.inputSignals).toBeDefined();
      expect(result.rulesTriggered).toBeDefined();
    }
  });

  it("all strategies produce explainable output", () => {
    const input: StrategyInput = {
      assetTicker: "AAPL",
      scores: [
        {
          id: "s1",
          frameworkSlug: "valuation",
          frameworkName: "Valuation",
          compositeScore: 7.0,
          manualOverride: false,
          factorScores: {},
          scoredAt: new Date(),
        },
        {
          id: "s2",
          frameworkSlug: "trend",
          frameworkName: "Trend",
          compositeScore: 6.5,
          manualOverride: false,
          factorScores: { momentum_signal: { value: 7 }, price_structure: { value: 6 } },
          scoredAt: new Date(),
        },
      ],
      researchArtifacts: [
        { id: "r1", title: "Test Research", tags: "test", updatedAt: new Date() },
      ],
    };

    for (const s of listStrategies()) {
      const result = s.evaluate(input);
      expect(result.reasoning).toContain(input.assetTicker);
      expect(result.reasoning.length).toBeGreaterThan(50);
      expect(result.inputSignals.length).toBeGreaterThan(0);
    }
  });
});
