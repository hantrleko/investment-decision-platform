"use server";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { generateToken } from "@/lib/api-tokens";
import { revalidatePath } from "next/cache";

const VALID_SCOPES = ["read", "read:assets", "read:decisions"];

export async function createApiToken(input: { name?: string; scopes?: string }) {
  // Token management is an admin-level operation.
  const authz = await requireRole("admin");
  if ("error" in authz) return { error: authz.error };

  const name = (input.name ?? "").trim();
  if (!name) return { error: "Token name is required" };

  const requested = (input.scopes ?? "read")
    .split(/\s+/)
    .filter(Boolean)
    .filter((s) => VALID_SCOPES.includes(s));
  const scopes = requested.length > 0 ? requested.join(" ") : "read";

  const { plaintext, hash } = generateToken();

  await prisma.apiToken.create({
    data: {
      name,
      tokenHash: hash,
      scopes,
      userId: authz.user.id,
    },
  });

  revalidatePath("/settings");
  // Plaintext is returned exactly once; it is never persisted or shown again.
  return { data: { plaintext, name, scopes } };
}

export async function revokeApiToken(input: { id: string }) {
  const authz = await requireRole("admin");
  if ("error" in authz) return { error: authz.error };

  await prisma.apiToken.update({
    where: { id: input.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings");
  return { data: { id: input.id } };
}
