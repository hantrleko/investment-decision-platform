import { describe, it, expect } from "vitest";
import {
  evaluateAlert,
  describeAlert,
  isAlertKind,
} from "@/lib/alerts/engine";

describe("alert engine", () => {
  it("triggers price_above at/above threshold", () => {
    expect(evaluateAlert({ kind: "price_above", threshold: 100 }, 100).triggered).toBe(true);
    expect(evaluateAlert({ kind: "price_above", threshold: 100 }, 101).triggered).toBe(true);
    expect(evaluateAlert({ kind: "price_above", threshold: 100 }, 99).triggered).toBe(false);
  });

  it("triggers price_below at/below threshold", () => {
    expect(evaluateAlert({ kind: "price_below", threshold: 50 }, 50).triggered).toBe(true);
    expect(evaluateAlert({ kind: "price_below", threshold: 50 }, 49).triggered).toBe(true);
    expect(evaluateAlert({ kind: "price_below", threshold: 50 }, 51).triggered).toBe(false);
  });

  it("triggers pct_change on absolute move beyond threshold (both directions)", () => {
    const up = evaluateAlert({ kind: "pct_change", threshold: 10, referencePrice: 100 }, 111);
    expect(up.triggered).toBe(true);
    expect(up.observed).toBeCloseTo(11);

    const down = evaluateAlert({ kind: "pct_change", threshold: 10, referencePrice: 100 }, 89);
    expect(down.triggered).toBe(true);

    const small = evaluateAlert({ kind: "pct_change", threshold: 10, referencePrice: 100 }, 105);
    expect(small.triggered).toBe(false);
  });

  it("does not trigger pct_change without a reference price", () => {
    expect(evaluateAlert({ kind: "pct_change", threshold: 10, referencePrice: null }, 120).triggered).toBe(false);
    expect(evaluateAlert({ kind: "pct_change", threshold: 10, referencePrice: 0 }, 120).triggered).toBe(false);
  });

  it("describes alerts readably", () => {
    expect(describeAlert({ kind: "price_above", threshold: 100 })).toContain("≥");
    expect(describeAlert({ kind: "price_below", threshold: 50 })).toContain("≤");
    expect(describeAlert({ kind: "pct_change", threshold: 10, referencePrice: 100 })).toContain("±10%");
  });

  it("validates alert kinds", () => {
    expect(isAlertKind("price_above")).toBe(true);
    expect(isAlertKind("nonsense")).toBe(false);
  });
});
