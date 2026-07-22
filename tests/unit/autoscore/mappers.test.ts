import { describe, it, expect } from "vitest";
import { mapValuationFactors } from "@/lib/autoscore/valuation-mapper";
import { mapTrendFactors } from "@/lib/autoscore/trend-mapper";
import { mapMacroFactors } from "@/lib/autoscore/macro-mapper";
import type { Fundamentals } from "@/lib/marketdata/yahoo";
import type { TrendIndicators } from "@/lib/autoscore/indicators";

function baseFundamentals(over: Partial<Fundamentals> = {}): Fundamentals {
  return {
    ticker: "TEST",
    name: "Test Corp",
    sector: "Technology",
    industry: "Software",
    exchange: "NMS",
    currency: "USD",
    marketCap: 1e11,
    enterpriseValue: 1.05e11,
    trailingPE: 18,
    forwardPE: 16,
    pegRatio: 1.2,
    priceToBook: 4,
    priceToSales: 5,
    enterpriseToEbitda: 12,
    enterpriseToRevenue: 5,
    profitMargins: 0.2,
    operatingMargins: 0.25,
    grossMargins: 0.55,
    returnOnEquity: 0.3,
    returnOnAssets: 0.12,
    revenueGrowth: 0.15,
    earningsGrowth: 0.18,
    earningsQuarterlyGrowth: 0.1,
    freeCashflow: 8e9,
    operatingCashflow: 1e10,
    totalCash: 2e10,
    totalDebt: 1e10,
    debtToEquity: 40,
    currentRatio: 1.8,
    quickRatio: 1.5,
    bookValue: 25,
    trailingEps: 6,
    forwardEps: 7,
    dividendYield: 0.01,
    payoutRatio: 0.15,
    beta: 1.1,
    fiftyTwoWeekHigh: 220,
    fiftyTwoWeekLow: 140,
    fiftyDayAverage: 190,
    twoHundredDayAverage: 175,
    averageVolume: 5e6,
    regularMarketPrice: 200,
    regularMarketVolume: 6e6,
    recommendationMean: 2.0,
    numberOfAnalystOpinions: 25,
    targetMeanPrice: 240,
    shortRatio: 2,
    heldPercentInsiders: 0.05,
    heldPercentInstitutions: 0.7,
    fcfYield: 0.08,
    netCashToMcap: 0.1,
    ...over,
  };
}

function baseTrend(over: Partial<TrendIndicators> = {}): TrendIndicators {
  return {
    price: 200,
    sma50: 190,
    sma150: 180,
    sma200: 170,
    sma200Slope20d: 0.02,
    rsi14: 58,
    return63d: 0.12,
    spyReturn63d: 0.04,
    relativeStrengthScore: 7.5,
    volumeRatio: 1.2,
    week52Position: 0.75,
    week52High: 220,
    week52Low: 140,
    pctAbove52wLow: 0.43,
    pctBelow52wHigh: 0.09,
    minerviniPassCount: 7,
    minerviniDetails: ["✓ sample"],
    phase: 2,
    phaseName: "Uptrend (Phase 2)",
    phaseConfidence: 80,
    ...over,
  };
}

describe("mapValuationFactors", () => {
  it("returns all five valuation factor slugs", () => {
    const result = mapValuationFactors(baseFundamentals());
    expect(Object.keys(result.factorScores).sort()).toEqual(
      [
        "catalyst_clarity",
        "intrinsic_value_discount",
        "margin_of_safety",
        "quality_moat",
        "sentiment_contrarian",
      ].sort()
    );
    for (const fs of Object.values(result.factorScores)) {
      expect(fs.value).toBeGreaterThanOrEqual(0);
      expect(fs.value).toBeLessThanOrEqual(10);
      expect(fs.note).toBeTruthy();
    }
  });

  it("scores quality higher for strong profitability", () => {
    const strong = mapValuationFactors(
      baseFundamentals({
        returnOnEquity: 0.4,
        profitMargins: 0.3,
        operatingMargins: 0.35,
        grossMargins: 0.7,
      })
    );
    const weak = mapValuationFactors(
      baseFundamentals({
        returnOnEquity: 0.02,
        profitMargins: 0.01,
        operatingMargins: 0.02,
        grossMargins: 0.15,
        sector: "Technology",
      })
    );
    expect(strong.factorScores.quality_moat.value).toBeGreaterThan(
      weak.factorScores.quality_moat.value
    );
  });

  it("scores cheaper multiples higher on intrinsic discount", () => {
    const cheap = mapValuationFactors(
      baseFundamentals({
        trailingPE: 10,
        forwardPE: 9,
        pegRatio: 0.7,
        enterpriseToEbitda: 7,
        priceToBook: 1.2,
      })
    );
    const rich = mapValuationFactors(
      baseFundamentals({
        trailingPE: 45,
        forwardPE: 40,
        pegRatio: 3.5,
        enterpriseToEbitda: 30,
        priceToBook: 12,
      })
    );
    expect(cheap.factorScores.intrinsic_value_discount.value).toBeGreaterThan(
      rich.factorScores.intrinsic_value_discount.value
    );
  });

  it("warns when PE missing", () => {
    const result = mapValuationFactors(
      baseFundamentals({ trailingPE: null, forwardPE: null })
    );
    expect(result.warnings.some((w) => /PE/i.test(w))).toBe(true);
  });
});

describe("mapTrendFactors", () => {
  it("returns all four trend factor slugs", () => {
    const result = mapTrendFactors(baseTrend());
    expect(Object.keys(result.factorScores).sort()).toEqual(
      [
        "momentum_signal",
        "price_structure",
        "relative_strength",
        "volume_confirmation",
      ].sort()
    );
  });

  it("scores strong structure higher than broken structure", () => {
    const strong = mapTrendFactors(baseTrend());
    const weak = mapTrendFactors(
      baseTrend({
        price: 80,
        sma50: 100,
        sma150: 110,
        sma200: 120,
        sma200Slope20d: -0.02,
        minerviniPassCount: 1,
        phase: 4,
        phaseName: "Downtrend (Phase 4)",
        relativeStrengthScore: 2,
        rsi14: 28,
        return63d: -0.15,
      })
    );
    expect(strong.factorScores.price_structure.value).toBeGreaterThan(
      weak.factorScores.price_structure.value
    );
    expect(strong.factorScores.momentum_signal.value).toBeGreaterThan(
      weak.factorScores.momentum_signal.value
    );
  });

  it("warns without SMA200 / SPY", () => {
    const result = mapTrendFactors(
      baseTrend({
        sma200: null,
        relativeStrengthScore: null,
      })
    );
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("mapMacroFactors", () => {
  it("returns all four macro factor slugs", () => {
    const result = mapMacroFactors(baseFundamentals(), baseTrend(), baseTrend());
    expect(Object.keys(result.factorScores).sort()).toEqual(
      [
        "fiscal_tailwind",
        "geopolitical_risk",
        "rate_sensitivity",
        "regime_alignment",
      ].sort()
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /proxy|directional|lightweight/i.test(w))).toBe(
      true
    );
  });

  it("rates rate-sensitive sectors lower on rate_sensitivity", () => {
    const tech = mapMacroFactors(
      baseFundamentals({ sector: "Technology", beta: 1.2 }),
      baseTrend(),
      baseTrend()
    );
    const utilities = mapMacroFactors(
      baseFundamentals({ sector: "Utilities", beta: 0.6, debtToEquity: 180 }),
      baseTrend(),
      baseTrend()
    );
    // Technology is often rate-sensitive growth; Utilities too — both may be lower
    // than Financials beneficiaries
    const banks = mapMacroFactors(
      baseFundamentals({ sector: "Financial Services", beta: 1.0 }),
      baseTrend(),
      baseTrend()
    );
    expect(banks.factorScores.rate_sensitivity.value).toBeGreaterThan(
      utilities.factorScores.rate_sensitivity.value
    );
    expect(tech.factorScores.regime_alignment.value).toBeGreaterThanOrEqual(5);
  });

  it("scores regime higher when both asset and SPY in phase 2", () => {
    const aligned = mapMacroFactors(
      baseFundamentals(),
      baseTrend({ phase: 2 }),
      baseTrend({ phase: 2 })
    );
    const riskOff = mapMacroFactors(
      baseFundamentals(),
      baseTrend({ phase: 4, phaseName: "Downtrend" }),
      baseTrend({ phase: 4, phaseName: "Downtrend" })
    );
    expect(aligned.factorScores.regime_alignment.value).toBeGreaterThan(
      riskOff.factorScores.regime_alignment.value
    );
  });
});
