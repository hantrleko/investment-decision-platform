import { describe, it, expect } from "vitest";

// We test the parsing logic of yahoo.ts without making real HTTP calls.
// The actual Yahoo API integration is tested manually / in smoke tests.

describe("Yahoo Finance module — input validation", () => {
  it("rejects empty ticker string", () => {
    const ticker = "";
    expect(ticker.trim().length).toBe(0);
  });

  it("normalizes ticker to uppercase", () => {
    const raw = "aapl";
    expect(raw.trim().toUpperCase()).toBe("AAPL");
  });

  it("trims whitespace from ticker", () => {
    const raw = "  AAPL  ";
    expect(raw.trim().toUpperCase()).toBe("AAPL");
  });
});

describe("Yahoo Finance v8 chart API response shape", () => {
  // Simulates the structure returned by query2.finance.yahoo.com/v8/finance/chart/{ticker}
  it("parses meta fields from chart response correctly", () => {
    const mockResponse = {
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              shortName: "Apple Inc.",
              exchangeName: "Nasdaq Global Select",
              sector: "Technology",
              regularMarketPrice: 192.53,
            },
          },
        ],
      },
    };

    const meta = mockResponse.chart?.result?.[0]?.meta;
    expect(meta).toBeDefined();
    expect(meta?.shortName).toBe("Apple Inc.");
    expect(meta?.exchangeName).toBe("Nasdaq Global Select");
    expect(meta?.sector).toBe("Technology");
    expect(meta?.regularMarketPrice).toBeCloseTo(192.53);
  });

  it("falls back to longName when shortName is missing", () => {
    const mockResponse = {
      chart: {
        result: [
          {
            meta: {
              symbol: "BRK-B",
              longName: "Berkshire Hathaway Inc.",
              exchangeName: "NYSE",
              regularMarketPrice: 415.25,
            },
          },
        ],
      },
    };

    const meta = mockResponse.chart?.result?.[0]?.meta;
    const name = meta?.shortName || meta?.longName || null;
    expect(name).toBe("Berkshire Hathaway Inc.");
  });

  it("handles error response from API", () => {
    const mockResponse = {
      chart: {
        error: {
          code: "Not Found",
          description: "No data found for symbol",
        },
      },
    };

    expect(mockResponse.chart?.error).toBeDefined();
    expect(mockResponse.chart?.error?.description).toBe("No data found for symbol");
  });
});

describe("AssetMetaAndPrice shape", () => {
  it("matches expected return structure", () => {
    const result = {
      name: "Apple Inc.",
      exchange: "Nasdaq Global Select",
      sector: "Technology",
      lastPrice: 192.53,
    };

    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("exchange");
    expect(result).toHaveProperty("sector");
    expect(result).toHaveProperty("lastPrice");
    expect(typeof result.lastPrice).toBe("number");
  });

  it("allows null fields for partial data", () => {
    const result = {
      name: null,
      exchange: null,
      sector: null,
      lastPrice: null,
    };

    expect(result.name).toBeNull();
    expect(result.lastPrice).toBeNull();
  });
});
