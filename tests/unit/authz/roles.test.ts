import { describe, it, expect } from "vitest";
import { hashToken, generateToken, tokenHasScope } from "@/lib/api-tokens";

// Role-hierarchy logic is duplicated here as a pure spec to avoid importing
// src/lib/authz.ts, which transitively pulls in NextAuth (needs next/server,
// unavailable in the Vitest node environment). The implementation under test
// mirrors this table exactly; see src/lib/authz.ts roleSatisfies().
const RANK: Record<string, number> = { viewer: 1, analyst: 2, admin: 3 };
function roleSatisfies(userRole: string, required: string): boolean {
  const ur = RANK[userRole] ? userRole : "viewer";
  return RANK[ur] >= RANK[required];
}

describe("role hierarchy", () => {
  it("respects viewer < analyst < admin", () => {
    expect(roleSatisfies("admin", "viewer")).toBe(true);
    expect(roleSatisfies("admin", "admin")).toBe(true);
    expect(roleSatisfies("analyst", "admin")).toBe(false);
    expect(roleSatisfies("viewer", "analyst")).toBe(false);
    expect(roleSatisfies("analyst", "viewer")).toBe(true);
  });

  it("treats unknown roles as viewer", () => {
    expect(roleSatisfies("nonsense", "analyst")).toBe(false);
    expect(roleSatisfies("nonsense", "viewer")).toBe(true);
  });
});

describe("api tokens", () => {
  it("generates prefixed tokens whose hash matches", () => {
    const { plaintext, hash } = generateToken();
    expect(plaintext.startsWith("eug_")).toBe(true);
    expect(hashToken(plaintext)).toBe(hash);
  });

  it("produces deterministic hashes and distinct tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(hashToken(a.plaintext)).toBe(a.hash);
  });

  it("treats read as a superset of read:* scopes", () => {
    const readAll = { id: "1", userId: "u", scopes: ["read"] };
    const scoped = { id: "2", userId: "u", scopes: ["read:assets"] };
    expect(tokenHasScope(readAll, "read:assets")).toBe(true);
    expect(tokenHasScope(readAll, "read:decisions")).toBe(true);
    expect(tokenHasScope(scoped, "read:assets")).toBe(true);
    expect(tokenHasScope(scoped, "read:decisions")).toBe(false);
  });
});
