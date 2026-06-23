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

/** Generic config object — strategy-specific shape is defined by each module's defaults. */
export type StrategyConfig = Record<string, number | boolean | string>;

/** Safely extract a numeric config value. */
function num(cfg: StrategyConfig, key: string): number {
  return Number(cfg[key]) || 0;
}

export interface StrategyModule {
  slug: string;
  name: string;
  description: string;
  version: string;
  requiredFrameworkSlugs: string[];
  /** Default config that will be used if no DB-backed config exists. */
  defaultConfig: StrategyConfig;
  /** Config field descriptors for the management UI. */
  configSchema: ConfigField[];
  evaluate: (input: StrategyInput, config?: StrategyConfig) => StrategyOutput;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "number" | "boolean";
  description?: string;
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

// ─── Default configs ───────────────────────────────────────────

const VALUATION_CONFIG: StrategyConfig = {
  strongBuyThreshold: 7.5,
  buyThreshold: 6.0,
  watchThreshold: 4.5,
  reviewThreshold: 3.0,
  researchSupportCount: 2,
};

const TREND_CONFIG: StrategyConfig = {
  buyThreshold: 7.0,
  watchThreshold: 5.5,
  reviewThreshold: 3.5,
  momentumConfirm: 7,
  priceStructureConfirm: 6,
  momentumDeteriorate: 3,
  priceStructureDeteriorate: 3,
};

const MULTISIGNAL_CONFIG: StrategyConfig = {
  minScores: 2,
  strongBuyAvg: 7.0,
  strongBuyMin: 5.0,
  buyAvg: 6.0,
  buyMin: 4.0,
  watchAvg: 4.5,
  reviewAvg: 3.0,
  penaltyThreshold: 3.0,
  researchStrongCount: 3,
};

// ─── Built-in Strategies ───────────────────────────────────────

// 1. Valuation First
registerStrategy({
  slug: "valuation-first",
  name: "Valuation First",
  description:
    "Prioritizes the Valuation framework score. Requires a Valuation score to run. Strong scores with quality/moat support produce Buy signals.",
  version: "1.0.0",
  requiredFrameworkSlugs: ["valuation"],
  defaultConfig: VALUATION_CONFIG,
  configSchema: [
    { key: "strongBuyThreshold", label: "Strong Buy Threshold", type: "number", description: "Composite >= this → Strong Buy" },
    { key: "buyThreshold", label: "Buy Threshold", type: "number", description: "Composite >= this → Buy" },
    { key: "watchThreshold", label: "Watch Threshold", type: "number", description: "Composite >= this → Watch" },
    { key: "reviewThreshold", label: "Review Threshold", type: "number", description: "Composite >= this → Review" },
    { key: "researchSupportCount", label: "Research Support Count", type: "number", description: "Research artifacts needed for support rule" },
  ],
  evaluate(input: StrategyInput, cfg?: StrategyConfig): StrategyOutput {
    const c = { ...VALUATION_CONFIG, ...cfg };
    const strongBuy = num(c, "strongBuyThreshold");
    const buy = num(c, "buyThreshold");
    const watch = num(c, "watchThreshold");
    const review = num(c, "reviewThreshold");
    const researchSupport = num(c, "researchSupportCount");

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

    if (composite >= strongBuy) {
      level = "Strong Buy";
      rules.push({
        rule: `composite >= ${strongBuy}`,
        detail: `Valuation composite ${composite.toFixed(2)} is strong (>= ${strongBuy})`,
      });
    } else if (composite >= buy) {
      level = "Buy";
      rules.push({
        rule: `composite >= ${buy}`,
        detail: `Valuation composite ${composite.toFixed(2)} is favorable (>= ${buy})`,
      });
    } else if (composite >= watch) {
      level = "Watch";
      rules.push({
        rule: `composite >= ${watch}`,
        detail: `Valuation composite ${composite.toFixed(2)} is moderate (>= ${watch}), monitor for improvement`,
      });
    } else if (composite >= review) {
      level = "Review";
      rules.push({
        rule: `composite >= ${review}`,
        detail: `Valuation composite ${composite.toFixed(2)} is weak (>= ${review}), requires deeper review`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: `composite < ${review}`,
        detail: `Valuation composite ${composite.toFixed(2)} is very low (< ${review})`,
      });
    }

    // Research support bonus
    if (input.researchArtifacts.length >= researchSupport && (level === "Strong Buy" || level === "Buy")) {
      rules.push({
        rule: `research_count >= ${researchSupport}`,
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
  defaultConfig: TREND_CONFIG,
  configSchema: [
    { key: "buyThreshold", label: "Buy Threshold", type: "number", description: "Trend composite >= this → Buy" },
    { key: "watchThreshold", label: "Watch Threshold", type: "number", description: "Trend composite >= this → Watch" },
    { key: "reviewThreshold", label: "Review Threshold", type: "number", description: "Trend composite >= this → Review" },
    { key: "momentumConfirm", label: "Momentum Confirm", type: "number", description: "Momentum >= this for upgrade confirmation" },
    { key: "priceStructureConfirm", label: "Price Structure Confirm", type: "number", description: "Price structure >= this for upgrade confirmation" },
    { key: "momentumDeteriorate", label: "Momentum Deteriorate", type: "number", description: "Momentum <= this triggers downgrade" },
    { key: "priceStructureDeteriorate", label: "Price Structure Deteriorate", type: "number", description: "Price structure <= this triggers downgrade" },
  ],
  evaluate(input: StrategyInput, cfg?: StrategyConfig): StrategyOutput {
    const c = { ...TREND_CONFIG, ...cfg };
    const buy = num(c, "buyThreshold");
    const watch = num(c, "watchThreshold");
    const review = num(c, "reviewThreshold");
    const momConfirm = num(c, "momentumConfirm");
    const psConfirm = num(c, "priceStructureConfirm");
    const momDeter = num(c, "momentumDeteriorate");
    const psDeter = num(c, "priceStructureDeteriorate");

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

    if (composite >= buy) {
      level = "Buy";
      rules.push({
        rule: `trend_composite >= ${buy}`,
        detail: `Trend composite ${composite.toFixed(2)} is strong`,
      });
    } else if (composite >= watch) {
      level = "Watch";
      rules.push({
        rule: `trend_composite >= ${watch}`,
        detail: `Trend composite ${composite.toFixed(2)} is moderate`,
      });
    } else if (composite >= review) {
      level = "Review";
      rules.push({
        rule: `trend_composite >= ${review}`,
        detail: `Trend composite ${composite.toFixed(2)} is weak`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: `trend_composite < ${review}`,
        detail: `Trend composite ${composite.toFixed(2)} is very weak`,
      });
    }

    // Momentum + price structure confirmation
    if (momentum != null && priceStructure != null) {
      if (momentum >= momConfirm && priceStructure >= psConfirm) {
        if (level === "Buy") {
          level = "Strong Buy";
          rules.push({
            rule: `momentum >= ${momConfirm} AND price_structure >= ${psConfirm}`,
            detail: "Momentum and price structure both confirm the trend",
          });
        } else if (level === "Watch") {
          level = "Buy";
          rules.push({
            rule: `momentum >= ${momConfirm} AND price_structure >= ${psConfirm}`,
            detail: "Momentum and price structure confirm upgrading to Buy",
          });
        }
      } else if (momentum <= momDeter && priceStructure <= psDeter) {
        level = level === "Avoid" ? "Reject" : "Avoid";
        rules.push({
          rule: `momentum <= ${momDeter} AND price_structure <= ${psDeter}`,
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
  defaultConfig: MULTISIGNAL_CONFIG,
  configSchema: [
    { key: "minScores", label: "Minimum Scores", type: "number", description: "Minimum number of framework scores required" },
    { key: "strongBuyAvg", label: "Strong Buy Avg", type: "number", description: "Average composite >= this for Strong Buy" },
    { key: "strongBuyMin", label: "Strong Buy Min", type: "number", description: "Minimum composite >= this for Strong Buy" },
    { key: "buyAvg", label: "Buy Avg", type: "number", description: "Average composite >= this for Buy" },
    { key: "buyMin", label: "Buy Min", type: "number", description: "Minimum composite >= this for Buy" },
    { key: "watchAvg", label: "Watch Avg", type: "number", description: "Average composite >= this for Watch" },
    { key: "reviewAvg", label: "Review Avg", type: "number", description: "Average composite >= this for Review" },
    { key: "penaltyThreshold", label: "Penalty Threshold", type: "number", description: "Minimum score below this triggers penalty" },
    { key: "researchStrongCount", label: "Research Strong Count", type: "number", description: "Research artifacts for strong evidence rule" },
  ],
  evaluate(input: StrategyInput, cfg?: StrategyConfig): StrategyOutput {
    const c = { ...MULTISIGNAL_CONFIG, ...cfg };
    const minScores = num(c, "minScores");
    const strongBuyAvg = num(c, "strongBuyAvg");
    const strongBuyMin = num(c, "strongBuyMin");
    const buyAvg = num(c, "buyAvg");
    const buyMin = num(c, "buyMin");
    const watchAvg = num(c, "watchAvg");
    const reviewAvg = num(c, "reviewAvg");
    const penaltyThreshold = num(c, "penaltyThreshold");
    const researchStrong = num(c, "researchStrongCount");

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

    if (validScores.length < minScores) {
      return {
        recommendation: "Review",
        reasoning: `Multi-Signal Gate requires at least ${minScores} framework scores. Found ${validScores.length}. Need more scoring data to generate a recommendation.`,
        inputSignals: signals,
        rulesTriggered: [
          {
            rule: `score_count < ${minScores}`,
            detail: `Only ${validScores.length} score(s) available — gate not met`,
          },
        ],
        scoreIds: validScores.map((s) => s.id),
        researchIds: input.researchArtifacts.map((r) => r.id),
      };
    }

    const avgComposite =
      validScores.reduce((sum, s) => sum + (s.compositeScore ?? 0), 0) /
      validScores.length;

    const minComposite = Math.min(
      ...validScores.map((s) => s.compositeScore ?? 0)
    );

    const rules: RuleTriggered[] = [];
    let level: RecommendationLevel = "Review";

    if (avgComposite >= strongBuyAvg && minComposite >= strongBuyMin) {
      level = "Strong Buy";
      rules.push({
        rule: `avg >= ${strongBuyAvg} AND min >= ${strongBuyMin}`,
        detail: `Average composite ${avgComposite.toFixed(2)} with minimum ${minComposite.toFixed(2)} — all frameworks aligned`,
      });
    } else if (avgComposite >= buyAvg && minComposite >= buyMin) {
      level = "Buy";
      rules.push({
        rule: `avg >= ${buyAvg} AND min >= ${buyMin}`,
        detail: `Average composite ${avgComposite.toFixed(2)} with minimum ${minComposite.toFixed(2)} — frameworks mostly aligned`,
      });
    } else if (avgComposite >= watchAvg) {
      level = "Watch";
      rules.push({
        rule: `avg >= ${watchAvg}`,
        detail: `Average composite ${avgComposite.toFixed(2)} — mixed signals, monitor`,
      });
    } else if (avgComposite >= reviewAvg) {
      level = "Review";
      rules.push({
        rule: `avg >= ${reviewAvg}`,
        detail: `Average composite ${avgComposite.toFixed(2)} — weak overall, deeper review needed`,
      });
    } else {
      level = "Avoid";
      rules.push({
        rule: `avg < ${reviewAvg}`,
        detail: `Average composite ${avgComposite.toFixed(2)} — very weak across frameworks`,
      });
    }

    // Minimum score penalty
    if (minComposite < penaltyThreshold) {
      if (level === "Buy" || level === "Strong Buy") {
        level = "Watch";
        rules.push({
          rule: `min < ${penaltyThreshold} (penalty)`,
          detail: `Lowest framework score is ${minComposite.toFixed(2)} — downgrading due to weak outlier`,
        });
      }
    }

    // Research support
    if (input.researchArtifacts.length >= researchStrong) {
      rules.push({
        rule: `research_count >= ${researchStrong}`,
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
