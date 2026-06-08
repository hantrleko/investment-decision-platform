import { describe, it, expect } from "vitest";
import { parseSchemaDefinition } from "@/lib/scoring/schema-parser";

const VALID_SCHEMA = JSON.stringify({
  version: 1,
  factors: [
    {
      slug: "test_factor",
      label: "Test Factor",
      description: "A test factor",
      weight: 1.0,
      range: { min: 0, max: 10 },
    },
  ],
  compositeMethod: "weighted_average",
});

describe("parseSchemaDefinition", () => {
  it("parses a valid schema definition", () => {
    const schema = parseSchemaDefinition(VALID_SCHEMA);
    expect(schema.version).toBe(1);
    expect(schema.factors).toHaveLength(1);
    expect(schema.factors[0].slug).toBe("test_factor");
    expect(schema.factors[0].weight).toBe(1.0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseSchemaDefinition("not json")).toThrow();
  });

  it("throws on schema missing factors", () => {
    const bad = JSON.stringify({ version: 1, factors: [], compositeMethod: "x" });
    expect(() => parseSchemaDefinition(bad)).toThrow();
  });

  it("throws on factor with weight out of range", () => {
    const bad = JSON.stringify({
      version: 1,
      factors: [{ slug: "a", label: "A", description: "", weight: 1.5, range: { min: 0, max: 10 } }],
      compositeMethod: "x",
    });
    expect(() => parseSchemaDefinition(bad)).toThrow();
  });
});
