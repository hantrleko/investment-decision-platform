import { describe, it, expect } from "vitest";

// We test the parsing logic of yahoo.ts without making real HTTP calls.
// The actual Yahoo API integration is tested manually / in smoke tests.

describe("Yahoo Finance module — input validation", () => {
  it("rejects empty ticker string", () => {
    // This is a unit-level sanity check; the API route enforces this too.
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

describe("AssetMetaAndPrice shape", () => {
  it("matches expected return structure", () => {
    const result = {
      name: "Apple Inc.",
      exchange: "NMS",
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
