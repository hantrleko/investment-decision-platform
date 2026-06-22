/**
 * Yahoo Finance market data provider.
 * Uses the v8 chart API which is more permissive than the v7 quote endpoint
 * and does not require authentication headers in most server environments.
 */

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

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export async function getAssetMetaAndPrice(
  ticker: string
): Promise<AssetMetaAndPrice> {
  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance API returned ${res.status}`);
  }

  const json = (await res.json()) as YahooChartResponse;

  if (json.chart?.error) {
    throw new Error(
      json.chart.error.description || `No data for ticker "${ticker}"`
    );
  }

  const meta = json.chart?.result?.[0]?.meta;
  if (!meta) {
    throw new Error(`No data returned for ticker "${ticker}"`);
  }

  return {
    name: meta.shortName || meta.longName || null,
    exchange: meta.exchangeName || null,
    sector: meta.sector || null,
    lastPrice: meta.regularMarketPrice ?? null,
  };
}

export async function getPrice(ticker: string): Promise<number | null> {
  const meta = await getAssetMetaAndPrice(ticker);
  return meta.lastPrice;
}
