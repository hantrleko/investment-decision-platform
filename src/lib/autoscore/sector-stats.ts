/**
 * Sector-relative benchmarks for Phase 2 auto-scoring.
 *
 * These are approximate cross-sectional anchors (mean / typical ranges)
 * for major GICS-like sectors. Used when live peer distributions are
 * unavailable. Values are deliberately conservative mid-cycle estimates.
 *
 * lowerIsBetter metrics: PE, PEG, EV/EBITDA, debtToEquity
 * higherIsBetter metrics: ROE, profitMargins, revenueGrowth, fcfYield
 */

export interface SectorMetricStats {
  mean: number;
  /** Approximate std used for z-score banding. */
  std: number;
  lowerIsBetter?: boolean;
}

export interface SectorBenchmarks {
  trailingPE: SectorMetricStats;
  pegRatio: SectorMetricStats;
  enterpriseToEbitda: SectorMetricStats;
  priceToBook: SectorMetricStats;
  returnOnEquity: SectorMetricStats;
  profitMargins: SectorMetricStats;
  operatingMargins: SectorMetricStats;
  grossMargins: SectorMetricStats;
  revenueGrowth: SectorMetricStats;
  earningsGrowth: SectorMetricStats;
  fcfYield: SectorMetricStats;
  debtToEquity: SectorMetricStats;
  currentRatio: SectorMetricStats;
}

const DEFAULT: SectorBenchmarks = {
  trailingPE: { mean: 22, std: 10, lowerIsBetter: true },
  pegRatio: { mean: 1.6, std: 0.8, lowerIsBetter: true },
  enterpriseToEbitda: { mean: 14, std: 6, lowerIsBetter: true },
  priceToBook: { mean: 3.5, std: 2.5, lowerIsBetter: true },
  returnOnEquity: { mean: 0.15, std: 0.1 },
  profitMargins: { mean: 0.12, std: 0.08 },
  operatingMargins: { mean: 0.15, std: 0.1 },
  grossMargins: { mean: 0.4, std: 0.2 },
  revenueGrowth: { mean: 0.08, std: 0.12 },
  earningsGrowth: { mean: 0.1, std: 0.2 },
  fcfYield: { mean: 0.04, std: 0.03 },
  debtToEquity: { mean: 80, std: 60, lowerIsBetter: true },
  currentRatio: { mean: 1.5, std: 0.8 },
};

const SECTOR_TABLE: Record<string, Partial<SectorBenchmarks>> = {
  Technology: {
    trailingPE: { mean: 28, std: 12, lowerIsBetter: true },
    pegRatio: { mean: 1.8, std: 0.9, lowerIsBetter: true },
    enterpriseToEbitda: { mean: 18, std: 8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.22, std: 0.12 },
    profitMargins: { mean: 0.18, std: 0.1 },
    operatingMargins: { mean: 0.22, std: 0.12 },
    grossMargins: { mean: 0.55, std: 0.2 },
    revenueGrowth: { mean: 0.12, std: 0.15 },
    fcfYield: { mean: 0.035, std: 0.025 },
    debtToEquity: { mean: 50, std: 40, lowerIsBetter: true },
  },
  "Communication Services": {
    trailingPE: { mean: 20, std: 10, lowerIsBetter: true },
    returnOnEquity: { mean: 0.14, std: 0.1 },
    profitMargins: { mean: 0.12, std: 0.1 },
    revenueGrowth: { mean: 0.06, std: 0.1 },
    debtToEquity: { mean: 70, std: 50, lowerIsBetter: true },
  },
  "Consumer Cyclical": {
    trailingPE: { mean: 20, std: 10, lowerIsBetter: true },
    returnOnEquity: { mean: 0.16, std: 0.12 },
    profitMargins: { mean: 0.08, std: 0.06 },
    revenueGrowth: { mean: 0.07, std: 0.12 },
    debtToEquity: { mean: 90, std: 70, lowerIsBetter: true },
  },
  "Consumer Defensive": {
    trailingPE: { mean: 22, std: 8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.18, std: 0.1 },
    profitMargins: { mean: 0.1, std: 0.06 },
    revenueGrowth: { mean: 0.04, std: 0.05 },
    fcfYield: { mean: 0.045, std: 0.02 },
    debtToEquity: { mean: 70, std: 40, lowerIsBetter: true },
  },
  Healthcare: {
    trailingPE: { mean: 24, std: 12, lowerIsBetter: true },
    returnOnEquity: { mean: 0.14, std: 0.12 },
    profitMargins: { mean: 0.12, std: 0.1 },
    revenueGrowth: { mean: 0.08, std: 0.12 },
    debtToEquity: { mean: 60, std: 50, lowerIsBetter: true },
  },
  Financials: {
    trailingPE: { mean: 14, std: 6, lowerIsBetter: true },
    priceToBook: { mean: 1.4, std: 0.7, lowerIsBetter: true },
    returnOnEquity: { mean: 0.12, std: 0.06 },
    profitMargins: { mean: 0.2, std: 0.1 },
    revenueGrowth: { mean: 0.05, std: 0.08 },
    // Banks report D/E differently; down-weight via wider std
    debtToEquity: { mean: 150, std: 120, lowerIsBetter: true },
  },
  "Financial Services": {
    trailingPE: { mean: 16, std: 7, lowerIsBetter: true },
    priceToBook: { mean: 1.6, std: 0.8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.13, std: 0.07 },
    profitMargins: { mean: 0.18, std: 0.1 },
    debtToEquity: { mean: 120, std: 100, lowerIsBetter: true },
  },
  Industrials: {
    trailingPE: { mean: 20, std: 8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.15, std: 0.08 },
    profitMargins: { mean: 0.09, std: 0.05 },
    revenueGrowth: { mean: 0.06, std: 0.1 },
    debtToEquity: { mean: 80, std: 50, lowerIsBetter: true },
  },
  Energy: {
    trailingPE: { mean: 12, std: 6, lowerIsBetter: true },
    enterpriseToEbitda: { mean: 6, std: 3, lowerIsBetter: true },
    returnOnEquity: { mean: 0.14, std: 0.12 },
    profitMargins: { mean: 0.1, std: 0.08 },
    fcfYield: { mean: 0.08, std: 0.05 },
    revenueGrowth: { mean: 0.04, std: 0.2 },
    debtToEquity: { mean: 60, std: 40, lowerIsBetter: true },
  },
  Utilities: {
    trailingPE: { mean: 18, std: 6, lowerIsBetter: true },
    returnOnEquity: { mean: 0.1, std: 0.04 },
    profitMargins: { mean: 0.12, std: 0.05 },
    revenueGrowth: { mean: 0.03, std: 0.05 },
    fcfYield: { mean: 0.03, std: 0.02 },
    debtToEquity: { mean: 120, std: 50, lowerIsBetter: true },
  },
  "Basic Materials": {
    trailingPE: { mean: 16, std: 8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.12, std: 0.1 },
    profitMargins: { mean: 0.1, std: 0.08 },
    revenueGrowth: { mean: 0.04, std: 0.15 },
    debtToEquity: { mean: 50, std: 40, lowerIsBetter: true },
  },
  "Real Estate": {
    trailingPE: { mean: 30, std: 15, lowerIsBetter: true },
    priceToBook: { mean: 2.0, std: 1.0, lowerIsBetter: true },
    returnOnEquity: { mean: 0.08, std: 0.06 },
    fcfYield: { mean: 0.04, std: 0.02 },
    debtToEquity: { mean: 100, std: 60, lowerIsBetter: true },
  },
  // Yahoo sometimes uses slightly different labels
  "Consumer Discretionary": {
    trailingPE: { mean: 20, std: 10, lowerIsBetter: true },
    returnOnEquity: { mean: 0.16, std: 0.12 },
    profitMargins: { mean: 0.08, std: 0.06 },
    revenueGrowth: { mean: 0.07, std: 0.12 },
  },
  "Consumer Staples": {
    trailingPE: { mean: 22, std: 8, lowerIsBetter: true },
    returnOnEquity: { mean: 0.18, std: 0.1 },
    profitMargins: { mean: 0.1, std: 0.06 },
    revenueGrowth: { mean: 0.04, std: 0.05 },
  },
  "Information Technology": {
    trailingPE: { mean: 28, std: 12, lowerIsBetter: true },
    returnOnEquity: { mean: 0.22, std: 0.12 },
    profitMargins: { mean: 0.18, std: 0.1 },
    revenueGrowth: { mean: 0.12, std: 0.15 },
  },
};

/** Normalize sector name for table lookup. */
export function normalizeSector(sector: string | null | undefined): string {
  if (!sector) return "Default";
  const s = sector.trim();
  if (SECTOR_TABLE[s]) return s;
  // Fuzzy contains
  const lower = s.toLowerCase();
  for (const key of Object.keys(SECTOR_TABLE)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return key;
    }
  }
  return "Default";
}

/** Resolve full benchmarks for a sector (merge with defaults). */
export function getSectorBenchmarks(
  sector: string | null | undefined
): SectorBenchmarks {
  const key = normalizeSector(sector);
  const overlay = key === "Default" ? {} : SECTOR_TABLE[key] ?? {};
  return {
    trailingPE: overlay.trailingPE ?? DEFAULT.trailingPE,
    pegRatio: overlay.pegRatio ?? DEFAULT.pegRatio,
    enterpriseToEbitda: overlay.enterpriseToEbitda ?? DEFAULT.enterpriseToEbitda,
    priceToBook: overlay.priceToBook ?? DEFAULT.priceToBook,
    returnOnEquity: overlay.returnOnEquity ?? DEFAULT.returnOnEquity,
    profitMargins: overlay.profitMargins ?? DEFAULT.profitMargins,
    operatingMargins: overlay.operatingMargins ?? DEFAULT.operatingMargins,
    grossMargins: overlay.grossMargins ?? DEFAULT.grossMargins,
    revenueGrowth: overlay.revenueGrowth ?? DEFAULT.revenueGrowth,
    earningsGrowth: overlay.earningsGrowth ?? DEFAULT.earningsGrowth,
    fcfYield: overlay.fcfYield ?? DEFAULT.fcfYield,
    debtToEquity: overlay.debtToEquity ?? DEFAULT.debtToEquity,
    currentRatio: overlay.currentRatio ?? DEFAULT.currentRatio,
  };
}

/** Sectors that are typically rate-sensitive (higher rates hurt). */
export const RATE_SENSITIVE_SECTORS = new Set([
  "Real Estate",
  "Utilities",
  "Technology",
  "Information Technology",
  "Consumer Cyclical",
  "Consumer Discretionary",
]);

/** Sectors that often benefit from higher rates / tight policy. */
export const RATE_BENEFICIARY_SECTORS = new Set([
  "Financials",
  "Financial Services",
  "Energy",
]);
