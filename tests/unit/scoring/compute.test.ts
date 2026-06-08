import { describe, it, expect } from "vitest";
import { computeComposite } from "@/lib/scoring/compute";
import type { FrameworkSchema } from "@/lib/scoring/compute";

const TEST_SCHEMA: FrameworkSchema = {
  version: 1,
  factors: [
    { slug: "a", label: "Factor A", description: "", weight: 0.5, range: { min: 0, max: 10 } },
    { slug: "b", label: "Factor B", description: "", weight: 0.3, range: { min: 0, max: 10 } },
    { slug: "c", label: "Factor C", description: "", weight: 0.2, range: { min: 0, max: 10 } },
  ],
  compositeMethod: "weighted_average",
};

describe("computeComposite", () => {
  it("computes weighted average correctly", () => {
    const result = computeComposite(TEST_SCHEMA, {
      a: { value: 10 },
      b: { value: 10 },
      c: { value: 10 },
    });
    expect(result).toBeCloseTo(10, 5);
  });

  it("computes partial scores", () => {
    const result = computeComposite(TEST_SCHEMA, {
      a: { value: 8 },
      b: { value: 6 },
      c: { value: 4 },
    });
    expect(result).toBeCloseTo(8 * 0.5 + 6 * 0.3 + 4 * 0.2, 5);
  });

  it("returns 0 when all factors are zero", () => {
    const result = computeComposite(TEST_SCHEMA, {
      a: { value: 0 },
      b: { value: 0 },
      c: { value: 0 },
    });
    expect(result).toBe(0);
  });

  it("skips missing factor scores", () => {
    const result = computeComposite(TEST_SCHEMA, {
      a: { value: 10 },
    });
    expect(result).toBeCloseTo(10 * 0.5, 5);
  });
});
