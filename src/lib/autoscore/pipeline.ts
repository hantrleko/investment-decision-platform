/**
 * Auto-evaluation pipeline (pure computation).
 * Fetches market data and produces factor scores for all three frameworks.
 * Persistence is handled by the server action layer.
 */

import {
  getFundamentals,
  getOhlcvBars,
  type Fundamentals,
  type OhlcvBar,
} from "@/lib/marketdata/yahoo";
import type { FactorScore } from "@/lib/scoring/compute";
import { computeComposite, type FrameworkSchema } from "@/lib/scoring/compute";
import { computeTrendIndicators, type TrendIndicators } from "./indicators";
import { mapValuationFactors } from "./valuation-mapper";
import { mapTrendFactors } from "./trend-mapper";
import { mapMacroFactors } from "./macro-mapper";
import { fmtLarge, fmtNum, fmtPct } from "./scoring-utils";

export type FrameworkSlug = "valuation" | "macro" | "trend";

export interface FrameworkAutoResult {
  slug: FrameworkSlug;
  factorScores: Record<string, FactorScore>;
  compositePreview: number | null;
  metricsUsed: Record<string, number | string | null>;
  warnings: string[];
}

export interface AutoEvaluateComputeResult {
  ticker: string;
  fundamentals: Fundamentals;
  assetTrend: TrendIndicators;
  spyTrend: TrendIndicators | null;
  frameworks: FrameworkAutoResult[];
  researchMarkdown: string;
  warnings: string[];
}

export interface PipelineOptions {
  /** Pre-parsed framework schemas keyed by slug (for composite preview). */
  schemas?: Partial<Record<FrameworkSlug, FrameworkSchema>>;
  /** Skip SPY fetch (tests). */
  skipSpy?: boolean;
  /** Injected data for tests. */
  inject?: {
    fundamentals?: Fundamentals;
    bars?: OhlcvBar[];
    spyBars?: OhlcvBar[];
  };
}

function previewComposite(
  slug: FrameworkSlug,
  factorScores: Record<string, FactorScore>,
  schemas?: Partial<Record<FrameworkSlug, FrameworkSchema>>
): number | null {
  const schema = schemas?.[slug];
  if (!schema) {
    // Unweighted mean fallback
    const vals = Object.values(factorScores).map((f) => f.value);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }
  return Math.round(computeComposite(schema, factorScores) * 100) / 100;
}

function buildResearchMarkdown(result: {
  ticker: string;
  fundamentals: Fundamentals;
  assetTrend: TrendIndicators;
  spyTrend: TrendIndicators | null;
  frameworks: FrameworkAutoResult[];
}): string {
  const f = result.fundamentals;
  const t = result.assetTrend;
  const lines: string[] = [];

  lines.push(`# Auto Evaluation — ${result.ticker}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Snapshot");
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Name | ${f.name ?? "—"} |`);
  lines.push(`| Sector | ${f.sector ?? "—"} / ${f.industry ?? "—"} |`);
  lines.push(`| Price | $${fmtNum(f.regularMarketPrice)} |`);
  lines.push(`| Market Cap | ${fmtLarge(f.marketCap)} |`);
  lines.push(`| Trailing PE | ${fmtNum(f.trailingPE)} |`);
  lines.push(`| Forward PE | ${fmtNum(f.forwardPE)} |`);
  lines.push(`| PEG | ${fmtNum(f.pegRatio)} |`);
  lines.push(`| EV/EBITDA | ${fmtNum(f.enterpriseToEbitda)} |`);
  lines.push(`| ROE | ${fmtPct(f.returnOnEquity)} |`);
  lines.push(`| Profit Margin | ${fmtPct(f.profitMargins)} |`);
  lines.push(`| Rev Growth | ${fmtPct(f.revenueGrowth)} |`);
  lines.push(`| FCF Yield | ${fmtPct(f.fcfYield)} |`);
  lines.push(`| Debt/Equity | ${fmtNum(f.debtToEquity, 1)} |`);
  lines.push(`| Beta | ${fmtNum(f.beta)} |`);
  lines.push("");

  lines.push("## Trend Structure");
  lines.push("");
  lines.push(`- **Phase:** ${t.phaseName} (confidence ${t.phaseConfidence}%)`);
  lines.push(`- **Minervini criteria:** ${t.minerviniPassCount}/8`);
  for (const d of t.minerviniDetails) {
    lines.push(`  - ${d}`);
  }
  lines.push(
    `- **SMAs:** 50=${fmtNum(t.sma50)} · 150=${fmtNum(t.sma150)} · 200=${fmtNum(t.sma200)}`
  );
  lines.push(
    `- **RSI14:** ${fmtNum(t.rsi14, 1)} · **63d return:** ${fmtPct(t.return63d)} · **SPY 63d:** ${fmtPct(t.spyReturn63d)}`
  );
  lines.push(
    `- **52w range:** $${fmtNum(t.week52Low)} – $${fmtNum(t.week52High)} (pos ${fmtNum(t.week52Position, 2)})`
  );
  if (result.spyTrend) {
    lines.push(`- **SPY phase:** ${result.spyTrend.phaseName}`);
  }
  lines.push("");

  lines.push("## Framework Scores (auto)");
  lines.push("");
  for (const fw of result.frameworks) {
    lines.push(
      `### ${fw.slug} — composite ≈ ${fw.compositePreview != null ? fw.compositePreview.toFixed(2) : "n/a"}`
    );
    lines.push("");
    for (const [slug, fs] of Object.entries(fw.factorScores)) {
      lines.push(`- **${slug}:** ${fs.value.toFixed(1)}/10 — ${fs.note ?? ""}`);
    }
    if (fw.warnings.length) {
      lines.push("");
      lines.push(`_Warnings:_ ${fw.warnings.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Scores are **machine-generated** from Yahoo Finance data + transparent rules."
  );
  lines.push(
    "- Valuation uses sector-relative grading where benchmarks exist; otherwise absolute anchors."
  );
  lines.push(
    "- Trend follows Minervini-style structure + RSI/volume/RS vs SPY."
  );
  lines.push(
    "- Macro factors are lightweight proxies (no live rates/fiscal feeds)."
  );
  lines.push("- Review and override any factor before acting on recommendations.");
  lines.push("");

  return lines.join("\n");
}

/**
 * Compute auto-evaluation for a ticker (no DB writes).
 */
export async function computeAutoEvaluation(
  ticker: string,
  options: PipelineOptions = {}
): Promise<AutoEvaluateComputeResult> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) throw new Error("Ticker is required");

  const warnings: string[] = [];

  // Parallel data fetch
  const [fundamentals, bars, spyBars] = await Promise.all([
    options.inject?.fundamentals
      ? Promise.resolve(options.inject.fundamentals)
      : getFundamentals(symbol),
    options.inject?.bars
      ? Promise.resolve(options.inject.bars)
      : getOhlcvBars(symbol, "1y"),
    options.skipSpy
      ? Promise.resolve(undefined)
      : options.inject?.spyBars
        ? Promise.resolve(options.inject.spyBars)
        : getOhlcvBars("SPY", "1y").catch((err) => {
            warnings.push(
              `SPY benchmark fetch failed: ${err instanceof Error ? err.message : "unknown"}`
            );
            return undefined;
          }),
  ]);

  if (!bars.length) {
    throw new Error(`No price history returned for ${symbol}`);
  }

  const assetTrend = computeTrendIndicators(bars, spyBars);
  const spyTrend = spyBars?.length
    ? computeTrendIndicators(spyBars)
    : null;

  const valuation = mapValuationFactors(fundamentals);
  const trend = mapTrendFactors(assetTrend);
  const macro = mapMacroFactors(fundamentals, assetTrend, spyTrend);

  const frameworks: FrameworkAutoResult[] = [
    {
      slug: "valuation",
      factorScores: valuation.factorScores,
      compositePreview: previewComposite(
        "valuation",
        valuation.factorScores,
        options.schemas
      ),
      metricsUsed: valuation.metricsUsed,
      warnings: valuation.warnings,
    },
    {
      slug: "trend",
      factorScores: trend.factorScores,
      compositePreview: previewComposite("trend", trend.factorScores, options.schemas),
      metricsUsed: trend.metricsUsed,
      warnings: trend.warnings,
    },
    {
      slug: "macro",
      factorScores: macro.factorScores,
      compositePreview: previewComposite("macro", macro.factorScores, options.schemas),
      metricsUsed: macro.metricsUsed,
      warnings: macro.warnings,
    },
  ];

  for (const fw of frameworks) {
    warnings.push(...fw.warnings.map((w) => `[${fw.slug}] ${w}`));
  }

  const researchMarkdown = buildResearchMarkdown({
    ticker: symbol,
    fundamentals,
    assetTrend,
    spyTrend,
    frameworks,
  });

  return {
    ticker: symbol,
    fundamentals,
    assetTrend,
    spyTrend,
    frameworks,
    researchMarkdown,
    warnings,
  };
}
