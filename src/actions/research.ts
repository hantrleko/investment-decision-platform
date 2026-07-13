"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createResearchSchema, updateResearchSchema, deleteResearchSchema } from "@/lib/validators/research";
import { revalidatePath } from "next/cache";

export async function createResearch(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;

  const parsed = createResearchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const assetTicker = data.assetTicker || null;

  // Validate asset exists if ticker provided
  if (assetTicker) {
    const asset = await prisma.asset.findUnique({ where: { ticker: assetTicker } });
    if (!asset) {
      return { error: `Asset with ticker "${assetTicker}" does not exist` };
    }
  }

  const artifact = await prisma.researchArtifact.create({
    data: {
      title: data.title,
      content: data.content,
      contentType: data.contentType,
      tags: data.tags,
      assetTicker,
      authorId: session.user.id,
    },
  });

  revalidatePath("/research");
  return { data: artifact };
}

export async function updateResearch(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const parsed = updateResearchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const { id, ...updates } = data;

  const existing = await prisma.researchArtifact.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Research artifact not found" };
  }

  // Validate asset exists if ticker provided
  const assetTicker = updates.assetTicker !== undefined ? updates.assetTicker || null : undefined;
  if (assetTicker) {
    const asset = await prisma.asset.findUnique({ where: { ticker: assetTicker } });
    if (!asset) {
      return { error: `Asset with ticker "${assetTicker}" does not exist` };
    }
  }

  const artifact = await prisma.researchArtifact.update({
    where: { id },
    data: { ...updates, assetTicker },
  });

  revalidatePath("/research");
  revalidatePath(`/research/${id}`);
  return { data: artifact };
}

export async function deleteResearch(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const parsed = deleteResearchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { id } = parsed.data;

  const existing = await prisma.researchArtifact.findUnique({
    where: { id },
    include: {
      scores: { select: { id: true } },
      decisions: { select: { decisionId: true } },
    },
  });

  if (!existing) {
    return { error: "Research artifact not found" };
  }

  const hasLinkedScores = existing.scores.length > 0;
  const hasLinkedDecisions = existing.decisions.length > 0;

  if (hasLinkedScores || hasLinkedDecisions) {
    return {
      error: "HAS_LINKS",
      linkedScores: existing.scores.length,
      linkedDecisions: existing.decisions.length,
    };
  }

  await prisma.researchArtifact.delete({ where: { id } });

  revalidatePath("/research");
  return { data: { id } };
}

export async function forceDeleteResearch(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const parsed = deleteResearchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { id } = parsed.data;

  await prisma.researchArtifact.delete({ where: { id } });

  revalidatePath("/research");
  return { data: { id } };
}
