import { describe, it, expect } from "vitest";
import { toCsv, csvResponse } from "@/lib/export/csv";

describe("csv export", () => {
  it("serializes rows with a header and BOM", () => {
    const csv = toCsv(
      [{ a: 1, b: "x" }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ]
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("A,B");
    expect(csv).toContain("1,x");
  });

  it("quotes and escapes fields with commas, quotes, and newlines", () => {
    const csv = toCsv(
      [{ v: 'he said "hi", then\nleft' }],
      [{ header: "V", value: (r) => r.v }]
    );
    expect(csv).toContain('"he said ""hi"", then\nleft"');
  });

  it("renders null/undefined as empty and Date as ISO", () => {
    const d = new Date("2024-01-01T00:00:00.000Z");
    const csv = toCsv(
      [{ n: null, u: undefined, d }],
      [
        { header: "N", value: (r) => r.n },
        { header: "U", value: (r) => r.u },
        { header: "D", value: (r) => r.d },
      ]
    );
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe(`,,2024-01-01T00:00:00.000Z`);
  });

  it("builds a downloadable CSV response", async () => {
    const res = csvResponse("\uFEFFA\r\n1", "test.csv");
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("test.csv");
    expect(await res.text()).toContain("A");
  });
});
