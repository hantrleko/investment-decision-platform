import type { FactorScore } from "@/lib/scoring/compute";

// ─── Types ─────────────────────────────────────────────────────

export type RecommendationLevel =
  | "Strong Buy"
  | "Buy"
  | "Watch"
  | "Review"
  | "Avoid"
  | "Reject";

export interface StrategyInput {
  assetTicker: string;
  scores: Array<{
    id: string;
    frameworkSlug: string;
    frameworkName: string;
    compositeScore: number | null;
    manualOverride: boolean;
    factorScores: Record<string, FactorScore>;
    scoredAt: Date;
  }>;
  researchArtifacts: Array<{
    id: string;
    title: string;
    tags: string;
    updatedAt: Date;
  }>;
}

export interface RuleTriggered {
  rule: string;
  detail: string;
}

export interface StrategyOutput {
  recommendation: RecommendationLevel;
  reasoning: string;
  inputSignals: Array<{ signal: string; value: string }>;
  rulesTriggered: RuleTriggered[];
  scoreIds: string[];
  researchIds: string[];
}

export interface StrategyModule {
  slug: string;
  name: string;
  description: string;
  version: string;
  requiredFrameworkSlugs: string[];
  evaluate: (input: StrategyInput) => StrategyOutput;
}

// ─── Registry ──────────────────────────────────────────────────

const registry = new Map<string, StrategyModule>();

export function registerStrategy(strategy: StrategyModule) {
  registry.set(strategy.slug, strategy);
}

export function getStrategy(slug: string): StrategyModule | undefined {
  return registry.get(slug);
}

export function listStrategies(): StrategyModule[] {
  return Array.from(registry.values());
}

// ─── Built-in Strategies ───────────────────────────────────────

// 1. Valuation First
registerStrategy({
  slug: "valuation-first",
  name: "Valuation First",
  description:
    "Prioritizes the Valuation framework score. Requires a Valuation score to run. Strong scores with quality/moat support produce Buy signals.",
  version: "1.0.0",
  requiredFrameworkSlugs: ["valuation"],
  evaluate(input: StrategyInput): StrategyOutput {
    const valScore = input.scores.find(
      (s) => s.frameworkSlug === "valuation"
    );

    if (!valScore || valScore.compositeScore == null) {
      return {
        recommendation: "Review",
        reasoning:
          "No Valuation framework score found for this asset. A Valuation score is required to generate a recommendation.",
        inputSignals: [{ signal: "valuation_score", value: "missing" }],
        rulesTriggered: [],
        scoreIds: [],
        researchIds: input.researchArtifacts.map((r) => r.id),
      };
    }

    const composite = valScore.compositeScore;
    const signals: Array<{ signal: string; value: string }> = [
      { signal: "valuation_composite", value: composite.toFixed(2) },
      { signal: "valuation_overridden", value: String(valScore.manualOverride) },
      { signal: "research_count", value: String(input.researchArtifacts.length) },
    ];

    const rules: RuleTriggered[] = [];
    let level: RecommendationLevel = "Review";

    if (composite >= 7.5) {
      level = "Strong Buy";
      rules.push({
        rule: "composite >= 7.5",
        detail: `Valuation composite ${composite.toFixed(2)} is strong (>= 7.5)`,
      });
    } else if (composite >= 6.0) {
      level = "Buy";
      rules.push({
        rule: "composite >= 6.0",
        detail: `Valuation composite ${composite.toFixed(2)} is favorable (>= 6.0)`,
      });
    } else if (composite >= 4.5) {
      level = "Watch";
      rules.push({
        rule: "composite >= 4.5",
        detail: `Valuation composite ${composite.toFixed(2)} is moderate (>= 4.5), monitor for improvement`,
      });
    } else if (composite >= 3.0) {
      level = "Review";
      rules.push({
        rule: "composite >= 3.0",
        detail: `Valuation composite ${composite.toFixed(2)} is weak (>= 3.0), requires deeper review`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: "composite < 3.0",
        detail: `Valuation composite ${composite.toFixed(2)} is very low (< 3.0)`,
      });
    }

    // Research support bonus
    if (input.researchArtifacts.length >= 2 && (level === "Strong Buy" || level === "Buy")) {
      rules.push({
        rule: "research_count >= 2",
        detail: `${input.researchArtifacts.length} research artifacts provide supporting evidence`,
      });
    }

    // Manual override caution
    if (valScore.manualOverride) {
      rules.push({
        rule: "manual_override",
        detail: "Valuation score has a manual override — treat with extra caution",
      });
    }

    const reasoning = `Valuation First strategy evaluated ${input.assetTicker} with a Valuation composite of ${composite.toFixed(2)}. Result: ${level}. ${rules.map((r) => r.detail).join(". ")}.`;

    return {
      recommendation: level,
      reasoning,
      inputSignals: signals,
      rulesTriggered: rules,
      scoreIds: [valScore.id],
      researchIds: input.researchArtifacts.map((r) => r.id),
    };
  },
});

// 2. Trend Confirmed
registerStrategy({
  slug: "trend-confirmed",
  name: "Trend Confirmed",
  description:
    "Uses the Trend framework as primary signal. Requires a Trend score. Looks for momentum and price structure alignment.",
  version: "1.0.0",
  requiredFrameworkSlugs: ["trend"],
  evaluate(input: StrategyInput): StrategyOutput {
    const trendScore = input.scores.find(
      (s) => s.frameworkSlug === "trend"
    );

    if (!trendScore || trendScore.compositeScore == null) {
      return {
        recommendation: "Review",
        reasoning:
          "No Trend framework score found for this asset. A Trend score is required to generate a recommendation.",
        inputSignals: [{ signal: "trend_score", value: "missing" }],
        rulesTriggered: [],
        scoreIds: [],
        researchIds: input.researchArtifacts.map((r) => r.id),
      };
    }

    const composite = trendScore.compositeScore;
    const fs = trendScore.factorScores;
    const momentum = fs["momentum_signal"]?.value;
    const priceStructure = fs["price_structure"]?.value;

    const signals: Array<{ signal: string; value: string }> = [
      { signal: "trend_composite", value: composite.toFixed(2) },
      { signal: "momentum_signal", value: momentum != null ? String(momentum) : "n/a" },
      { signal: "price_structure", value: priceStructure != null ? String(priceStructure) : "n/a" },
    ];

    const rules: RuleTriggered[] = [];
    let level: RecommendationLevel = "Review";

    // Composite-based base level
    if (composite >= 7.0) {
      level = "Buy";
      rules.push({
        rule: "trend_composite >= 7.0",
        detail: `Trend composite ${composite.toFixed(2)} is strong`,
      });
    } else if (composite >= 5.5) {
      level = "Watch";
      rules.push({
        rule: "trend_composite >= 5.5",
        detail: `Trend composite ${composite.toFixed(2)} is moderate`,
      });
    } else if (composite >= 3.5) {
      level = "Review";
      rules.push({
        rule: "trend_composite >= 3.5",
        detail: `Trend composite ${composite.toFixed(2)} is weak`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: "trend_composite < 3.5",
        detail: `Trend composite ${composite.toFixed(2)} is very weak`,
      });
    }

    // Momentum + price structure confirmation
    if (momentum != null && priceStructure != null) {
      if (momentum >= 7 && priceStructure >= 6) {
        if (level === "Buy") {
          level = "Strong Buy";
          rules.push({
            rule: "momentum >= 7 AND price_structure >= 6",
            detail: "Momentum and price structure both confirm the trend",
          });
        } else if (level === "Watch") {
          level = "Buy";
          rules.push({
            rule: "momentum >= 7 AND price_structure >= 6",
            detail: "Momentum and price structure confirm upgrading to Buy",
          });
        }
      } else if (momentum <= 3 && priceStructure <= 3) {
        level = level === "Avoid" ? "Reject" : "Avoid";
        rules.push({
          rule: "momentum <= 3 AND price_structure <= 3",
          detail: "Momentum and price structure both deteriorating",
        });
      }
    }

    const reasoning = `Trend Confirmed strategy evaluated ${input.assetTicker} with a Trend composite of ${composite.toFixed(2)}. Momentum: ${momentum ?? "n/a"}, Price Structure: ${priceStructure ?? "n/a"}. Result: ${level}. ${rules.map((r) => r.detail).join(". ")}.`;

    return {
      recommendation: level,
      reasoning,
      inputSignals: signals,
      rulesTriggered: rules,
      scoreIds: [trendScore.id],
      researchIds: input.researchArtifacts.map((r) => r.id),
    };
  },
});

// 3. Multi-Signal Gate
registerStrategy({
  slug: "multi-signal-gate",
  name: "Multi-Signal Gate",
  description:
    "Requires at least 2 framework scores. Combines all available scores and research to produce a gated recommendation. More scores = higher confidence.",
  version: "1.0.0",
  requiredFrameworkSlugs: [],
  evaluate(input: StrategyInput): StrategyOutput {
    const validScores = input.scores.filter(
      (s) => s.compositeScore != null
    );

    const signals: Array<{ signal: string; value: string }> = [
      { signal: "score_count", value: String(validScores.length) },
      { signal: "research_count", value: String(input.researchArtifacts.length) },
      ...validScores.map((s) => ({
        signal: `${s.frameworkSlug}_composite`,
        value: s.compositeScore!.toFixed(2),
      })),
    ];

    if (validScores.length < 2) {
      return {
        recommendation: "Review",
        reasoning: `Multi-Signal Gate requires at least 2 framework scores. Found ${validScores.length}. Need more scoring data to generate a recommendation.`,
        inputSignals: signals,
        rulesTriggered: [
          {
            rule: "score_count < 2",
            detail: `Only ${validScores.length} score(s) available — gate not met`,
          },
        ],
        scoreIds: validScores.map((s) => s.id),
        researchIds: input.researchArtifacts.map((r) => r.id),
      };
    }

    // Calculate average composite across all frameworks
    const avgComposite =
      validScores.reduce((sum, s) => sum + (s.compositeScore ?? 0), 0) /
      validScores.length;

    const minComposite = Math.min(
      ...validScores.map((s) => s.compositeScore ?? 0)
    );

    const rules: RuleTriggered[] = [];
    let level: RecommendationLevel = "Review";

    // Gate 1: Average composite
    if (avgComposite >= 7.0 && minComposite >= 5.0) {
      level = "Strong Buy";
      rules.push({
        rule: "avg >= 7.0 AND min >= 5.0",
        detail: `Average composite ${avgComposite.toFixed(2)} with minimum ${minComposite.toFixed(2)} — all frameworks aligned`,
      });
    } else if (avgComposite >= 6.0 && minComposite >= 4.0) {
      level = "Buy";
      rules.push({
        rule: "avg >= 6.0 AND min >= 4.0",
        detail: `Average composite ${avgComposite.toFixed(2)} with minimum ${minComposite.toFixed(2)} — frameworks mostly aligned`,
      });
    } else if (avgComposite >= 4.5) {
      level = "Watch";
      rules.push({
        rule: "avg >= 4.5",
        detail: `Average composite ${avgComposite.toFixed(2)} — mixed signals, monitor`,
      });
    } else if (avgComposite >= 3.0) {
      level = "Review";
      rules.push({
        rule: "avg >= 3.0",
        detail: `Average composite ${avgComposite.toFixed(2)} — weak overall, deeper review needed`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: "avg < 3.0",
        detail: `Average composite ${avgComposite.toFixed(2)} — very weak across frameworks`,
      });
    }

    // Gate 2: Minimum score penalty
    if (minComposite < 3.0) {
      if (level === "Buy" || level === "Strong Buy") {
        level = "Watch";
        rules.push({
          rule: "min < 3.0 (penalty)",
          detail: `Lowest framework score is ${minComposite.toFixed(2)} — downgrading due to weak outlier`,
        });
      }
    }

    // Gate 3: Research support
    if (input.researchArtifacts.length >= 3) {
      rules.push({
        rule: "research_count >= 3",
        detail: `${input.researchArtifacts.length} research artifacts provide strong supporting evidence`,
      });
    } else if (input.researchArtifacts.length === 0) {
      rules.push({
        rule: "research_count == 0",
        detail: "No research artifacts — recommendation based on scores only",
      });
    }

    const reasoning = `Multi-Signal Gate strategy evaluated ${input.assetTicker} across ${validScores.length} framework(s). Average composite: ${avgComposite.toFixed(2)}, Minimum: ${minComposite.toFixed(2)}. Result: ${level}. ${rules.map((r) => r.detail).join(". ")}.`;

    return {
      recommendation: level,
      reasoning,
      inputSignals: signals,
      rulesTriggered: rules,
      scoreIds: validScores.map((s) => s.id),
      researchIds: input.researchArtifacts.map((r) => r.id),
    };
  },
});
