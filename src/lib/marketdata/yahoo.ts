/**
 * Yahoo Finance market data provider.
 * Uses the v8 chart API which is more permissive than the v7 quote endpoint
 * and does not require authentication headers in most server environments.
 *
 * Resilience features:
 *  - Retry with exponential backoff + jitter on transient failures (429/5xx/network).
 *  - In-memory TTL cache to reduce request volume and mitigate rate limiting.
 *  - Historical price series fetch (used by the backtest engine).
 */

import { logger } from "@/lib/logger";

const YF_CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart";

interface YahooChartMeta {
  symbol?: string;
  shortName?: string;
  longName?: string;
  exchangeName?: string;
  sector?: string;
  industry?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ close?: (number | null)[] }>;
    adjclose?: Array<{ adjclose?: (number | null)[] }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { code?: string; description?: string };
  };
}

interface AssetMetaAndPrice {
  name: string | null;
  exchange: string | null;
  sector: string | null;
  lastPrice: number | null;
}

export interface PricePoint {
  date: Date;
  close: number;
}

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json",
};

// ---------------------------------------------------------------------------
// Configuration (env-overridable)
// ---------------------------------------------------------------------------

const MAX_RETRIES = Number(process.env.YF_MAX_RETRIES ?? 3);
const BASE_DELAY_MS = Number(process.env.YF_BASE_DELAY_MS ?? 400);
const TIMEOUT_MS = Number(process.env.YF_TIMEOUT_MS ?? 8000);
const CACHE_TTL_MS = Number(process.env.YF_CACHE_TTL_MS ?? 60_000);

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Clear the market-data cache (primarily for tests / manual refresh). */
export function clearMarketDataCache() {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Fetch with retry + exponential backoff + jitter
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<YahooChartResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          const delay =
            BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 200);
          logger.warn("Yahoo Finance transient error, retrying", {
            status: res.status,
            attempt: attempt + 1,
            delayMs: delay,
          });
          await sleep(delay);
          continue;
        }
        throw new Error(`Yahoo Finance API returned ${res.status}`);
      }

      return (await res.json()) as YahooChartResponse;
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "TimeoutError";
      const retryable = isAbort || err instanceof TypeError; // network errors
      if (retryable && attempt < MAX_RETRIES) {
        const delay =
          BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 200);
        logger.warn("Yahoo Finance request failed, retrying", {
          attempt: attempt + 1,
          delayMs: delay,
          error: err,
        });
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Yahoo Finance request failed after retries");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAssetMetaAndPrice(
  ticker: string
): Promise<AssetMetaAndPrice> {
  const key = `meta:${ticker.toUpperCase()}`;
  const cached = getCached<AssetMetaAndPrice>(key);
  if (cached) return cached;

  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const json = await fetchWithRetry(url);

  if (json.chart?.error) {
    throw new Error(
      json.chart.error.description || `No data for ticker "${ticker}"`
    );
  }

  const meta = json.chart?.result?.[0]?.meta;
  if (!meta) {
    throw new Error(`No data returned for ticker "${ticker}"`);
  }

  const result: AssetMetaAndPrice = {
    name: meta.shortName || meta.longName || null,
    exchange: meta.exchangeName || null,
    sector: meta.sector || null,
    lastPrice: meta.regularMarketPrice ?? null,
  };

  setCached(key, result);
  return result;
}

export async function getPrice(ticker: string): Promise<number | null> {
  const meta = await getAssetMetaAndPrice(ticker);
  return meta.lastPrice;
}

/**
 * Fetch a daily historical close-price series for the given ticker.
 * @param range Yahoo range string, e.g. "1mo", "6mo", "1y", "2y", "5y", "max".
 */
export async function getHistoricalPrices(
  ticker: string,
  range: string = "1y"
): Promise<PricePoint[]> {
  const key = `hist:${ticker.toUpperCase()}:${range}`;
  const cached = getCached<PricePoint[]>(key);
  if (cached) return cached;

  const url = `${YF_CHART_URL}/${encodeURIComponent(
    ticker
  )}?interval=1d&range=${encodeURIComponent(range)}`;
  const json = await fetchWithRetry(url);

  if (json.chart?.error) {
    throw new Error(
      json.chart.error.description || `No data for ticker "${ticker}"`
    );
  }

  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes =
    result?.indicators?.adjclose?.[0]?.adjclose ??
    result?.indicators?.quote?.[0]?.close ??
    [];

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || Number.isNaN(close)) continue;
    points.push({ date: new Date(timestamps[i] * 1000), close });
  }

  // Historical data changes slowly; cache longer than intraday quotes.
  setCached(key, points, Math.max(CACHE_TTL_MS, 15 * 60_000));
  return points;
}
