import { describe, it, expect } from "vitest";
import { computeAutoEvaluation } from "@/lib/autoscore/pipeline";
import type { Fundamentals, OhlcvBar } from "@/lib/marketdata/yahoo";
import type { FrameworkSchema } from "@/lib/scoring/compute";

function risingBars(n: number, start = 100, end = 160): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(n - 1, 1);
    const close = start + (end - start) * t;
    bars.push({
      date: new Date(Date.UTC(2024, 0, 1 + i)),
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000 + (i % 5) * 50_000,
    });
  }
  return bars;
}

const sampleFundamentals: Fundamentals = {
  ticker: "AAPL",
  name: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  exchange: "NMS",
  currency: "USD",
  marketCap: 3e12,
  enterpriseValue: 3.1e12,
  trailingPE: 28,
  forwardPE: 25,
  pegRatio: 2.1,
  priceToBook: 40,
  priceToSales: 7,
  enterpriseToEbitda: 22,
  enterpriseToRevenue: 7.5,
  profitMargins: 0.25,
  operatingMargins: 0.3,
  grossMargins: 0.45,
  returnOnEquity: 1.5,
  returnOnAssets: 0.28,
  revenueGrowth: 0.06,
  earningsGrowth: 0.1,
  earningsQuarterlyGrowth: 0.05,
  freeCashflow: 1e11,
  operatingCashflow: 1.2e11,
  totalCash: 6e10,
  totalDebt: 1e11,
  debtToEquity: 150,
  currentRatio: 1.0,
  quickRatio: 0.9,
  bookValue: 4,
  trailingEps: 6.5,
  forwardEps: 7.2,
  dividendYield: 0.005,
  payoutRatio: 0.15,
  beta: 1.2,
  fiftyTwoWeekHigh: 220,
  fiftyTwoWeekLow: 160,
  fiftyDayAverage: 200,
  twoHundredDayAverage: 190,
  averageVolume: 5e7,
  regularMarketPrice: 210,
  regularMarketVolume: 6e7,
  recommendationMean: 2.1,
  numberOfAnalystOpinions: 40,
  targetMeanPrice: 240,
  shortRatio: 1.5,
  heldPercentInsiders: 0.07,
  heldPercentInstitutions: 0.6,
  fcfYield: 0.033,
  netCashToMcap: -0.013,
};

const valuationSchema: FrameworkSchema = {
  version: 1,
  compositeMethod: "weighted_average",
  factors: [
    {
      slug: "intrinsic_value_discount",
      label: "Discount",
      description: "",
      weight: 0.25,
      range: { min: 0, max: 10 },
    },
    {
      slug: "margin_of_safety",
      label: "Safety",
      description: "",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
    {
      slug: "catalyst_clarity",
      label: "Catalyst",
      description: "",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
    {
      slug: "quality_moat",
      label: "Quality",
      description: "",
      weight: 0.2,
      range: { min: 0, max: 10 },
    },
    {
      slug: "sentiment_contrarian",
      label: "Sentiment",
      description: "",
      weight: 0.15,
      range: { min: 0, max: 10 },
    },
  ],
};

describe("computeAutoEvaluation", () => {
  it("maps all three frameworks from injected data", async () => {
    const bars = risingBars(260, 150, 210);
    const spyBars = risingBars(260, 400, 450);

    const result = await computeAutoEvaluation("aapl", {
      inject: {
        fundamentals: sampleFundamentals,
        bars,
        spyBars,
      },
      schemas: { valuation: valuationSchema },
    });

    expect(result.ticker).toBe("AAPL");
    expect(result.frameworks).toHaveLength(3);
    const slugs = result.frameworks.map((f) => f.slug).sort();
    expect(slugs).toEqual(["macro", "trend", "valuation"]);

    for (const fw of result.frameworks) {
      expect(Object.keys(fw.factorScores).length).toBeGreaterThanOrEqual(4);
      expect(fw.compositePreview).not.toBeNull();
      expect(fw.compositePreview!).toBeGreaterThanOrEqual(0);
      expect(fw.compositePreview!).toBeLessThanOrEqual(10);
    }

    // Valuation composite uses schema weights
    const val = result.frameworks.find((f) => f.slug === "valuation")!;
    expect(val.compositePreview).not.toBeNull();

    expect(result.researchMarkdown).toContain("Auto Evaluation — AAPL");
    expect(result.researchMarkdown).toContain("## Framework Scores");
    expect(result.assetTrend.phase).toBeDefined();
    expect(result.spyTrend).not.toBeNull();
  });

  it("throws when bars are empty", async () => {
    await expect(
      computeAutoEvaluation("EMPTY", {
        inject: {
          fundamentals: sampleFundamentals,
          bars: [],
        },
        skipSpy: true,
      })
    ).rejects.toThrow(/No price history/i);
  });

  it("works without SPY (skipSpy)", async () => {
    const result = await computeAutoEvaluation("TEST", {
      inject: {
        fundamentals: sampleFundamentals,
        bars: risingBars(220, 100, 130),
      },
      skipSpy: true,
    });
    expect(result.spyTrend).toBeNull();
    const trend = result.frameworks.find((f) => f.slug === "trend")!;
    expect(trend.warnings.some((w) => /SPY|RS/i.test(w))).toBe(true);
  });
});
