import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAssetMetaAndPrice,
  getHistoricalPrices,
  clearMarketDataCache,
} from "@/lib/marketdata/yahoo";

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const META_BODY = {
  chart: {
    result: [
      {
        meta: {
          symbol: "AAPL",
          shortName: "Apple Inc.",
          exchangeName: "Nasdaq",
          sector: "Technology",
          regularMarketPrice: 192.53,
        },
      },
    ],
  },
};

describe("Yahoo Finance resilience", () => {
  beforeEach(() => {
    clearMarketDataCache();
    vi.restoreAllMocks();
    process.env.YF_BASE_DELAY_MS = "1"; // keep retries fast in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMarketDataCache();
  });

  it("caches meta responses (second call does not hit network)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(META_BODY));

    const first = await getAssetMetaAndPrice("AAPL");
    const second = await getAssetMetaAndPrice("AAPL");

    expect(first.lastPrice).toBeCloseTo(192.53);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries on a 429 then succeeds", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJsonResponse({}, false, 429))
      .mockResolvedValueOnce(mockJsonResponse(META_BODY));

    const result = await getAssetMetaAndPrice("AAPL");
    expect(result.name).toBe("Apple Inc.");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up after max retries on persistent 503", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({}, false, 503));

    await expect(getAssetMetaAndPrice("AAPL")).rejects.toThrow(/503/);
    // MAX_RETRIES defaults to 3 → initial attempt + 3 retries = 4 calls
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("does NOT retry on a non-retryable 404", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({}, false, 404));

    await expect(getAssetMetaAndPrice("NOPE")).rejects.toThrow(/404/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("parses a historical price series and skips null closes", async () => {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      chart: {
        result: [
          {
            timestamp: [now - 172800, now - 86400, now],
            indicators: {
              adjclose: [{ adjclose: [100, null, 102] }],
            },
          },
        ],
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse(body));

    const points = await getHistoricalPrices("AAPL", "5d");
    expect(points).toHaveLength(2);
    expect(points[0].close).toBe(100);
    expect(points[1].close).toBe(102);
    expect(points[0].date).toBeInstanceOf(Date);
  });
});
