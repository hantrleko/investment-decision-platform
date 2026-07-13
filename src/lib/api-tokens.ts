/**
 * API token utilities for the read-only public API (/api/v1/*).
 *
 * Tokens are random 32-byte hex strings prefixed with "eug_". Only the
 * SHA-256 hash is persisted; the plaintext is returned once at creation time.
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const TOKEN_PREFIX = "eug_";

export function generateToken(): { plaintext: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const plaintext = `${TOKEN_PREFIX}${raw}`;
  return { plaintext, hash: hashToken(plaintext) };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export interface VerifiedToken {
  id: string;
  userId: string;
  scopes: string[];
}

/**
 * Extract and verify a bearer token from a request's Authorization header.
 * Returns the token record (with scopes) or null. Also stamps lastUsedAt.
 */
export async function verifyApiToken(
  request: Request
): Promise<VerifiedToken | null> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const plaintext = match[1].trim();
  if (!plaintext.startsWith(TOKEN_PREFIX)) return null;

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(plaintext) },
  });

  if (!token || token.revokedAt) return null;

  // Best-effort usage timestamp (do not block the request on it).
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => logger.warn("Failed to stamp token lastUsedAt", { tokenId: token.id, error: err }));

  return {
    id: token.id,
    userId: token.userId,
    scopes: token.scopes.split(/\s+/).filter(Boolean),
  };
}

export function tokenHasScope(token: VerifiedToken, scope: string): boolean {
  // "read" is a superset that grants all read:* scopes.
  return (
    token.scopes.includes(scope) ||
    (scope.startsWith("read:") && token.scopes.includes("read"))
  );
}
