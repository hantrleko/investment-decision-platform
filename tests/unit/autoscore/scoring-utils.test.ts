import { describe, it, expect } from "vitest";
import {
  clamp,
  linearMap,
  inverseLinearMap,
  gradeMetric,
  avg,
  weightedAvg,
  round1,
  fmtPct,
  fmtNum,
  fmtLarge,
} from "@/lib/autoscore/scoring-utils";

describe("clamp", () => {
  it("clamps within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("handles NaN as min", () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
  });
});

describe("linearMap / inverseLinearMap", () => {
  it("maps low→high linearly", () => {
    expect(linearMap(0, 0, 10)).toBe(0);
    expect(linearMap(10, 0, 10)).toBe(10);
    expect(linearMap(5, 0, 10)).toBe(5);
  });

  it("clamps outside input range", () => {
    expect(linearMap(-5, 0, 10)).toBe(0);
    expect(linearMap(20, 0, 10)).toBe(10);
  });

  it("inverts for lower-is-better metrics", () => {
    expect(inverseLinearMap(0, 0, 10)).toBe(10);
    expect(inverseLinearMap(10, 0, 10)).toBe(0);
    expect(inverseLinearMap(5, 0, 10)).toBe(5);
  });

  it("handles equal anchors", () => {
    expect(linearMap(5, 3, 3)).toBe(5);
  });
});

describe("gradeMetric", () => {
  it("returns null for missing values", () => {
    expect(gradeMetric(null, { excellent: 1, poor: 0 })).toBeNull();
    expect(gradeMetric(undefined, { excellent: 1, poor: 0 })).toBeNull();
  });

  it("uses absolute anchors (higher is better)", () => {
    const score = gradeMetric(0.25, { excellent: 0.25, poor: 0.05 });
    expect(score).toBe(10);
    const mid = gradeMetric(0.15, { excellent: 0.25, poor: 0.05 });
    expect(mid).toBe(5);
  });

  it("uses absolute anchors (lower is better)", () => {
    const cheap = gradeMetric(12, {
      excellent: 12,
      poor: 40,
      lowerIsBetter: true,
    });
    expect(cheap).toBe(10);
    const expensive = gradeMetric(40, {
      excellent: 12,
      poor: 40,
      lowerIsBetter: true,
    });
    expect(expensive).toBe(0);
  });

  it("prefers sector z-score when mean/std present", () => {
    // value = mean → z=0 → mid score 5
    const atMean = gradeMetric(20, {
      excellent: 10,
      poor: 40,
      lowerIsBetter: true,
      sectorMean: 20,
      sectorStd: 5,
    });
    expect(atMean).toBe(5);

    // 1.5σ below mean with lowerIsBetter → high score
    const cheap = gradeMetric(12.5, {
      excellent: 10,
      poor: 40,
      lowerIsBetter: true,
      sectorMean: 20,
      sectorStd: 5,
    });
    expect(cheap).toBe(10);
  });
});

describe("avg / weightedAvg", () => {
  it("averages non-null values", () => {
    expect(avg([1, 2, 3])).toBe(2);
    expect(avg([1, null, 3])).toBe(2);
    expect(avg([null, undefined])).toBeNull();
  });

  it("weighted average renormalizes", () => {
    expect(weightedAvg([
      { value: 10, weight: 0.5 },
      { value: 0, weight: 0.5 },
    ])).toBe(5);
    expect(
      weightedAvg([
        { value: 10, weight: 1 },
        { value: null, weight: 1 },
      ])
    ).toBe(10);
    expect(weightedAvg([{ value: null, weight: 1 }])).toBeNull();
  });
});

describe("formatters", () => {
  it("formats numbers and percents", () => {
    expect(fmtNum(1.234)).toBe("1.23");
    expect(fmtNum(null)).toBe("n/a");
    expect(fmtPct(0.156)).toBe("15.6%");
    expect(fmtPct(null)).toBe("n/a");
    expect(fmtLarge(2.5e9)).toBe("2.50B");
    expect(fmtLarge(1.2e12)).toBe("1.20T");
    expect(round1(3.14)).toBe(3.1);
  });
});
