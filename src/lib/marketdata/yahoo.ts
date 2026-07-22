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

// ---------------------------------------------------------------------------
// OHLCV bars (full candle data for technical indicators)
// ---------------------------------------------------------------------------

export interface OhlcvBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch daily OHLCV bars. Uses adjclose for close when available.
 * @param range Yahoo range string, e.g. "6mo", "1y", "2y".
 */
export async function getOhlcvBars(
  ticker: string,
  range: string = "1y"
): Promise<OhlcvBar[]> {
  const key = `ohlcv:${ticker.toUpperCase()}:${range}`;
  const cached = getCached<OhlcvBar[]>(key);
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
  const quote = result?.indicators?.quote?.[0] as
    | {
        open?: (number | null)[];
        high?: (number | null)[];
        low?: (number | null)[];
        close?: (number | null)[];
        volume?: (number | null)[];
      }
    | undefined;
  const adj =
    result?.indicators?.adjclose?.[0]?.adjclose ?? quote?.close ?? [];

  const bars: OhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = adj[i] ?? quote?.close?.[i];
    if (close == null || Number.isNaN(close)) continue;
    const open = quote?.open?.[i] ?? close;
    const high = quote?.high?.[i] ?? close;
    const low = quote?.low?.[i] ?? close;
    const volume = quote?.volume?.[i] ?? 0;
    bars.push({
      date: new Date(timestamps[i] * 1000),
      open: open ?? close,
      high: high ?? close,
      low: low ?? close,
      close,
      volume: volume ?? 0,
    });
  }

  setCached(key, bars, Math.max(CACHE_TTL_MS, 15 * 60_000));
  return bars;
}

// ---------------------------------------------------------------------------
// Fundamentals via Yahoo quoteSummary
// ---------------------------------------------------------------------------

const YF_QUOTE_SUMMARY_URL =
  "https://query2.finance.yahoo.com/v10/finance/quoteSummary";

export interface Fundamentals {
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  currency: string | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  enterpriseToEbitda: number | null;
  enterpriseToRevenue: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  grossMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  earningsQuarterlyGrowth: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  bookValue: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  averageVolume: number | null;
  regularMarketPrice: number | null;
  regularMarketVolume: number | null;
  recommendationMean: number | null;
  numberOfAnalystOpinions: number | null;
  targetMeanPrice: number | null;
  shortRatio: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  fcfYield: number | null;
  netCashToMcap: number | null;
}

type YahooRawValue = { raw?: number; fmt?: string } | number | null | undefined;

function rawNum(v: YahooRawValue): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object" && typeof v.raw === "number") {
    return Number.isFinite(v.raw) ? v.raw : null;
  }
  return null;
}

interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<Record<string, Record<string, YahooRawValue> | undefined>>;
    error?: { code?: string; description?: string };
  };
}

// ---------------------------------------------------------------------------
// Yahoo crumb + cookie session (required by quoteSummary)
// ---------------------------------------------------------------------------

interface YahooSession {
  crumb: string;
  cookie: string;
  fetchedAt: number;
}

let yahooSession: YahooSession | null = null;
const SESSION_TTL_MS = 45 * 60_000; // crumbs typically last ~1h

function mergeSetCookie(existing: string, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const header of setCookieHeaders) {
    const first = header.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function getSetCookieHeaders(res: Response): string[] {
  // Node 20+ / undici
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

async function ensureYahooSession(force = false): Promise<YahooSession> {
  if (
    !force &&
    yahooSession &&
    Date.now() - yahooSession.fetchedAt < SESSION_TTL_MS
  ) {
    return yahooSession;
  }

  let cookie = "";

  // Seed cookies (A1/A3). www.yahoo.com is more reliable than finance.yahoo.com
  // in Node/undici environments; fc.yahoo.com may 404 but still sets A3.
  const seedUrls = [
    "https://fc.yahoo.com",
    "https://www.yahoo.com/",
    "https://finance.yahoo.com/",
  ];
  for (const seedUrl of seedUrls) {
    try {
      const seed = await fetch(seedUrl, {
        headers: {
          ...FETCH_HEADERS,
          Accept: "text/html,application/xhtml+xml",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
      });
      cookie = mergeSetCookie(cookie, getSetCookieHeaders(seed));
      await seed.arrayBuffer().catch(() => undefined);
    } catch (err) {
      logger.warn("Yahoo cookie seed failed", { url: seedUrl, error: err });
    }
  }

  if (!cookie) {
    throw new Error("Yahoo cookie seed produced no cookies");
  }

  const crumbUrl = "https://query2.finance.yahoo.com/v1/test/getcrumb";
  const crumbRes = await fetch(crumbUrl, {
    headers: {
      ...FETCH_HEADERS,
      Accept: "text/plain",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  cookie = mergeSetCookie(cookie, getSetCookieHeaders(crumbRes));

  if (!crumbRes.ok) {
    throw new Error(`Yahoo crumb request failed (${crumbRes.status})`);
  }

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 40 || /<|>|html/i.test(crumb)) {
    throw new Error("Yahoo crumb response invalid");
  }

  yahooSession = { crumb, cookie, fetchedAt: Date.now() };
  return yahooSession;
}

async function fetchJsonWithRetry<T>(
  url: string,
  options?: { authed?: boolean }
): Promise<T> {
  const authed = options?.authed === true;
  let lastError: unknown;
  let refreshedSession = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = { ...FETCH_HEADERS };
      let finalUrl = url;

      if (authed) {
        const session = await ensureYahooSession(refreshedSession);
        if (session.cookie) headers.Cookie = session.cookie;
        const sep = finalUrl.includes("?") ? "&" : "?";
        finalUrl = `${finalUrl}${sep}crumb=${encodeURIComponent(session.crumb)}`;
      }

      const res = await fetch(finalUrl, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // Capture any new cookies from this response
      if (authed && yahooSession) {
        const sc = getSetCookieHeaders(res);
        if (sc.length) {
          yahooSession = {
            ...yahooSession,
            cookie: mergeSetCookie(yahooSession.cookie, sc),
          };
        }
      }

      if (!res.ok) {
        // Crumb/cookie expired → refresh once and retry
        if (
          authed &&
          (res.status === 401 || res.status === 403) &&
          !refreshedSession
        ) {
          refreshedSession = true;
          yahooSession = null;
          logger.warn("Yahoo auth failed, refreshing crumb session", {
            status: res.status,
          });
          continue;
        }
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

      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "TimeoutError";
      const retryable = isAbort || err instanceof TypeError;
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

/**
 * Fetch fundamental / valuation statistics for a ticker via Yahoo quoteSummary.
 * Modules: summaryProfile, defaultKeyStatistics, financialData, summaryDetail.
 */

/** Minimal fundamentals shell used when quoteSummary is unavailable. */
function emptyFundamentals(symbol: string, partial?: Partial<Fundamentals>): Fundamentals {
  return {
    ticker: symbol,
    name: null,
    sector: null,
    industry: null,
    exchange: null,
    currency: null,
    marketCap: null,
    enterpriseValue: null,
    trailingPE: null,
    forwardPE: null,
    pegRatio: null,
    priceToBook: null,
    priceToSales: null,
    enterpriseToEbitda: null,
    enterpriseToRevenue: null,
    profitMargins: null,
    operatingMargins: null,
    grossMargins: null,
    returnOnEquity: null,
    returnOnAssets: null,
    revenueGrowth: null,
    earningsGrowth: null,
    earningsQuarterlyGrowth: null,
    freeCashflow: null,
    operatingCashflow: null,
    totalCash: null,
    totalDebt: null,
    debtToEquity: null,
    currentRatio: null,
    quickRatio: null,
    bookValue: null,
    trailingEps: null,
    forwardEps: null,
    dividendYield: null,
    payoutRatio: null,
    beta: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    fiftyDayAverage: null,
    twoHundredDayAverage: null,
    averageVolume: null,
    regularMarketPrice: null,
    regularMarketVolume: null,
    recommendationMean: null,
    numberOfAnalystOpinions: null,
    targetMeanPrice: null,
    shortRatio: null,
    heldPercentInsiders: null,
    heldPercentInstitutions: null,
    fcfYield: null,
    netCashToMcap: null,
    ...partial,
  };
}

export async function getFundamentals(ticker: string): Promise<Fundamentals> {
  const symbol = ticker.toUpperCase();
  const key = `fund:${symbol}`;
  const cached = getCached<Fundamentals>(key);
  if (cached) return cached;

  const modules = [
    "summaryProfile",
    "defaultKeyStatistics",
    "financialData",
    "summaryDetail",
    "price",
  ].join(",");

  const url = `${YF_QUOTE_SUMMARY_URL}/${encodeURIComponent(
    symbol
  )}?modules=${modules}`;

  let json: QuoteSummaryResponse;
  try {
    json = await fetchJsonWithRetry<QuoteSummaryResponse>(url, { authed: true });
  } catch (err) {
    // Fall back to chart meta so Trend auto-score still works without full fundamentals
    logger.warn("Yahoo quoteSummary failed, falling back to chart meta", {
      ticker: symbol,
      error: err,
    });
    try {
      const meta = await getAssetMetaAndPrice(symbol);
      const fallback = emptyFundamentals(symbol, {
        name: meta.name,
        exchange: meta.exchange,
        sector: meta.sector,
        regularMarketPrice: meta.lastPrice,
      });
      setCached(key, fallback, Math.max(CACHE_TTL_MS, 5 * 60_000));
      return fallback;
    } catch {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (json.quoteSummary?.error) {
    throw new Error(
      json.quoteSummary.error.description ||
        `No fundamentals for ticker "${ticker}"`
    );
  }

  const result = json.quoteSummary?.result?.[0];
  if (!result) {
    throw new Error(`No fundamentals returned for ticker "${ticker}"`);
  }

  const profile = (result.summaryProfile ?? {}) as Record<string, YahooRawValue>;
  const keyStats = (result.defaultKeyStatistics ?? {}) as Record<
    string,
    YahooRawValue
  >;
  const fin = (result.financialData ?? {}) as Record<string, YahooRawValue>;
  const detail = (result.summaryDetail ?? {}) as Record<string, YahooRawValue>;
  const price = (result.price ?? {}) as Record<string, YahooRawValue>;

  const marketCap =
    rawNum(price.marketCap) ??
    rawNum(detail.marketCap) ??
    rawNum(keyStats.marketCap);
  const freeCashflow = rawNum(fin.freeCashflow);
  const totalCash = rawNum(fin.totalCash);
  const totalDebt = rawNum(fin.totalDebt);

  const fcfYield =
    marketCap && freeCashflow != null && marketCap > 0
      ? freeCashflow / marketCap
      : null;
  const netCashToMcap =
    marketCap && totalCash != null && totalDebt != null && marketCap > 0
      ? (totalCash - totalDebt) / marketCap
      : null;

  const fundamentals: Fundamentals = {
    ticker: symbol,
    name:
      (typeof price.shortName === "string" ? price.shortName : null) ||
      (typeof price.longName === "string" ? price.longName : null) ||
      null,
    sector: typeof profile.sector === "string" ? profile.sector : null,
    industry: typeof profile.industry === "string" ? profile.industry : null,
    exchange:
      (typeof price.exchangeName === "string" ? price.exchangeName : null) ||
      null,
    currency:
      (typeof price.currency === "string" ? price.currency : null) || null,
    marketCap,
    enterpriseValue: rawNum(keyStats.enterpriseValue),
    trailingPE: rawNum(summaryOr(detail, keyStats, "trailingPE")),
    forwardPE: rawNum(fin.forwardPE) ?? rawNum(detail.forwardPE),
    pegRatio: rawNum(keyStats.pegRatio) ?? rawNum(detail.pegRatio),
    priceToBook: rawNum(keyStats.priceToBook) ?? rawNum(detail.priceToBook),
    priceToSales:
      rawNum(keyStats.priceToSalesTrailing12Months) ??
      rawNum(detail.priceToSalesTrailing12Months),
    enterpriseToEbitda: rawNum(keyStats.enterpriseToEbitda),
    enterpriseToRevenue: rawNum(keyStats.enterpriseToRevenue),
    profitMargins: rawNum(fin.profitMargins) ?? rawNum(keyStats.profitMargins),
    operatingMargins: rawNum(fin.operatingMargins),
    grossMargins: rawNum(fin.grossMargins),
    returnOnEquity: rawNum(fin.returnOnEquity),
    returnOnAssets: rawNum(fin.returnOnAssets),
    revenueGrowth: rawNum(fin.revenueGrowth),
    earningsGrowth: rawNum(fin.earningsGrowth),
    earningsQuarterlyGrowth: rawNum(keyStats.earningsQuarterlyGrowth),
    freeCashflow,
    operatingCashflow: rawNum(fin.operatingCashflow),
    totalCash,
    totalDebt,
    debtToEquity: rawNum(fin.debtToEquity),
    currentRatio: rawNum(fin.currentRatio),
    quickRatio: rawNum(fin.quickRatio),
    bookValue: rawNum(keyStats.bookValue),
    trailingEps: rawNum(keyStats.trailingEps),
    forwardEps: rawNum(keyStats.forwardEps),
    dividendYield: rawNum(detail.dividendYield) ?? rawNum(keyStats.yield),
    payoutRatio: rawNum(keyStats.payoutRatio) ?? rawNum(detail.payoutRatio),
    beta: rawNum(keyStats.beta) ?? rawNum(detail.beta),
    fiftyTwoWeekHigh: rawNum(detail.fiftyTwoWeekHigh) ?? rawNum(summaryOr(detail, keyStats, "fiftyTwoWeekHigh")),
    fiftyTwoWeekLow: rawNum(detail.fiftyTwoWeekLow),
    fiftyDayAverage: rawNum(detail.fiftyDayAverage),
    twoHundredDayAverage: rawNum(detail.twoHundredDayAverage),
    averageVolume: rawNum(detail.averageVolume) ?? rawNum(detail.averageDailyVolume10Day),
    regularMarketPrice: rawNum(price.regularMarketPrice) ?? rawNum(fin.currentPrice),
    regularMarketVolume: rawNum(price.regularMarketVolume),
    recommendationMean: rawNum(fin.recommendationMean),
    numberOfAnalystOpinions: rawNum(fin.numberOfAnalystOpinions),
    targetMeanPrice: rawNum(fin.targetMeanPrice),
    shortRatio: rawNum(keyStats.shortRatio),
    heldPercentInsiders: rawNum(keyStats.heldPercentInsiders),
    heldPercentInstitutions: rawNum(keyStats.heldPercentInstitutions),
    fcfYield,
    netCashToMcap,
  };

  // Fundamentals change slowly — cache 30 min
  setCached(key, fundamentals, Math.max(CACHE_TTL_MS, 30 * 60_000));
  return fundamentals;
}

function summaryOr(
  a: Record<string, YahooRawValue>,
  b: Record<string, YahooRawValue>,
  key: string
): YahooRawValue {
  return a[key] ?? b[key];
}
