"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createDecisionSchema, recordOutcomeSchema } from "@/lib/validators/decision";
import { revalidatePath } from "next/cache";

export async function createDecision(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;

  const parsed = createDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  // Validate research artifacts exist
  if (data.researchArtifactIds.length > 0) {
    const count = await prisma.researchArtifact.count({
      where: { id: { in: data.researchArtifactIds } },
    });
    if (count !== data.researchArtifactIds.length) {
      return { error: "One or more research artifacts not found" };
    }
  }

  // Validate scores exist
  if (data.scoreIds.length > 0) {
    const count = await prisma.score.count({
      where: { id: { in: data.scoreIds } },
    });
    if (count !== data.scoreIds.length) {
      return { error: "One or more scores not found" };
    }
  }

  const decision = await prisma.decision.create({
    data: {
      title: data.title,
      direction: data.direction,
      thesis: data.thesis,
      authorId: session.user.id,
      researchLinks: {
        create: data.researchArtifactIds.map((artifactId) => ({
          researchArtifactId: artifactId,
        })),
      },
      scoreLinks: {
        create: data.scoreIds.map((scoreId) => ({
          scoreId,
        })),
      },
    },
    include: {
      researchLinks: { include: { researchArtifact: { select: { id: true, title: true } } } },
      scoreLinks: { include: { score: { include: { framework: { select: { name: true } } } } } },
    },
  });

  // Revalidate asset pages for linked research/scores
  const assetTickers = new Set<string>();
  if (data.researchArtifactIds.length > 0) {
    const artifacts = await prisma.researchArtifact.findMany({
      where: { id: { in: data.researchArtifactIds } },
      select: { assetTicker: true },
    });
    artifacts.forEach((a) => { if (a.assetTicker) assetTickers.add(a.assetTicker); });
  }
  if (data.scoreIds.length > 0) {
    const scores = await prisma.score.findMany({
      where: { id: { in: data.scoreIds } },
      select: { assetTicker: true },
    });
    scores.forEach((s) => assetTickers.add(s.assetTicker));
  }

  revalidatePath("/decisions");
  for (const ticker of assetTickers) {
    revalidatePath(`/assets/${ticker}`);
  }
  for (const artifactId of data.researchArtifactIds) {
    revalidatePath(`/research/${artifactId}`);
  }

  return { data: decision };
}

export async function recordOutcome(input: unknown) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };

  const parsed = recordOutcomeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const existing = await prisma.decision.findUnique({
    where: { id: data.decisionId },
  });
  if (!existing) {
    return { error: "Decision not found" };
  }
  if (existing.status === "closed") {
    return { error: "Decision is already closed" };
  }

  const decision = await prisma.decision.update({
    where: { id: data.decisionId },
    data: {
      outcome: data.outcome,
      outcomeNote: data.outcomeNote || null,
      outcomeDate: new Date(),
      status: "closed",
    },
  });

  revalidatePath(`/decisions/${data.decisionId}`);
  revalidatePath("/decisions");

  // Revalidate asset pages
  const links = await prisma.decision.findUnique({
    where: { id: data.decisionId },
    include: {
      researchLinks: { include: { researchArtifact: { select: { assetTicker: true } } } },
      scoreLinks: { include: { score: { select: { assetTicker: true } } } },
    },
  });

  if (links) {
    const tickers = new Set<string>();
    links.researchLinks.forEach((l) => { if (l.researchArtifact.assetTicker) tickers.add(l.researchArtifact.assetTicker); });
    links.scoreLinks.forEach((l) => tickers.add(l.score.assetTicker));
    for (const ticker of tickers) {
      revalidatePath(`/assets/${ticker}`);
    }
  }

  return { data: decision };
}
