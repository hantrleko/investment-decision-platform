import { describe, it, expect } from "vitest";
import { buildProvenance } from "@/lib/scoring/provenance";

describe("buildProvenance", () => {
  it("creates a valid provenance record", () => {
    const json = buildProvenance("manual");
    const record = JSON.parse(json);

    expect(record.source).toBe("manual");
    expect(record.timestamp).toBeDefined();
    expect(new Date(record.timestamp).getTime()).not.toBeNaN();
  });

  it("includes optional fields", () => {
    const json = buildProvenance("research", {
      artifactId: "abc123",
      note: "Based on Q3 earnings",
    });
    const record = JSON.parse(json);

    expect(record.source).toBe("research");
    expect(record.artifactId).toBe("abc123");
    expect(record.note).toBe("Based on Q3 earnings");
  });

  it("omits undefined optional fields", () => {
    const json = buildProvenance("csv");
    const record = JSON.parse(json);

    expect(record.artifactId).toBeUndefined();
    expect(record.note).toBeUndefined();
  });
});

  it("supports auto provenance source", () => {
    const json = buildProvenance("auto", { note: "Yahoo pipeline" });
    const record = JSON.parse(json);
    expect(record.source).toBe("auto");
    expect(record.note).toBe("Yahoo pipeline");
  });

