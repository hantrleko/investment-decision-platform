import { describe, it, expect } from "vitest";

describe("FTS search utility", () => {
  it("module imports without error", async () => {
    const mod = await import("@/lib/search/fts");
    expect(mod.searchResearch).toBeDefined();
    expect(typeof mod.searchResearch).toBe("function");
  });
});
