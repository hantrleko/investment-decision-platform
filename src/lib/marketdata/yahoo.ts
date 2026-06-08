const YF_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const YF_QUOTE_FIELDS = "shortName,regularMarketPrice,regularMarketTime,exchange,sector";

interface YahooQuoteResult {
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  exchange?: string;
  sector?: string;
}

interface AssetMetaAndPrice {
  name: string | null;
  exchange: string | null;
  sector: string | null;
  lastPrice: number | null;
}

export async function getAssetMetaAndPrice(ticker: string): Promise<AssetMetaAndPrice> {
  const url = `${YF_QUOTE_URL}?symbols=${encodeURIComponent(ticker)}&fields=${YF_QUOTE_FIELDS}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance API returned ${res.status}`);
  }

  const json = await res.json();
  const result = json?.quoteResponse?.result?.[0] as YahooQuoteResult | undefined;

  if (!result) {
    throw new Error(`No data returned for ticker "${ticker}"`);
  }

  return {
    name: result.shortName ?? null,
    exchange: result.exchange ?? null,
    sector: result.sector ?? null,
    lastPrice: result.regularMarketPrice ?? null,
  };
}

export async function getPrice(ticker: string): Promise<number | null> {
  const meta = await getAssetMetaAndPrice(ticker);
  return meta.lastPrice;
}
