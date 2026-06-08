"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { createScoreSchema, overrideCompositeSchema } from "@/lib/validators/scoring";
import { computeComposite } from "@/lib/scoring/compute";
import { parseSchemaDefinition } from "@/lib/scoring/schema-parser";
import { buildProvenance } from "@/lib/scoring/provenance";
import { revalidatePath } from "next/cache";

export async function createScore(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = createScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  // Validate framework exists and is active
  const framework = await prisma.framework.findUnique({
    where: { id: data.frameworkId },
  });
  if (!framework) {
    return { error: "Framework not found" };
  }
  if (!framework.isActive) {
    return { error: "Framework is not active" };
  }

  // Validate asset exists
  const asset = await prisma.asset.findUnique({
    where: { ticker: data.assetTicker },
  });
  if (!asset) {
    return { error: `Asset "${data.assetTicker}" does not exist` };
  }

  // Validate research artifact if provided
  if (data.researchArtifactId) {
    const artifact = await prisma.researchArtifact.findUnique({
      where: { id: data.researchArtifactId },
    });
    if (!artifact) {
      return { error: "Research artifact not found" };
    }
  }

  // Compute composite from schema + factor scores
  const schema = parseSchemaDefinition(framework.schemaDefinition);
  const compositeScore = computeComposite(schema, data.factorScores);

  // Build provenance
  const provenance = buildProvenance(
    data.researchArtifactId ? "research" : "manual",
    {
      artifactId: data.researchArtifactId,
      note: `Scored via ${framework.name} framework`,
    }
  );

  const score = await prisma.score.create({
    data: {
      frameworkId: data.frameworkId,
      assetTicker: data.assetTicker,
      researchArtifactId: data.researchArtifactId || null,
      factorScores: JSON.stringify(data.factorScores),
      compositeScore,
      provenance,
    },
    include: {
      framework: { select: { name: true, slug: true } },
      asset: { select: { ticker: true, name: true } },
    },
  });

  revalidatePath(`/assets/${data.assetTicker}`);
  revalidatePath("/scores");
  return { data: score };
}

export async function overrideComposite(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = overrideCompositeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const existing = await prisma.score.findUnique({
    where: { id: data.scoreId },
  });
  if (!existing) {
    return { error: "Score not found" };
  }

  // Override: set compositeScore to the override value, mark manualOverride
  // Note: we do NOT null out compositeScore — we replace it with the override value
  // so the detail page can display it. manualOverride flag distinguishes origin.
  const score = await prisma.score.update({
    where: { id: data.scoreId },
    data: {
      compositeScore: data.overrideValue,
      manualOverride: true,
      overrideNote: data.overrideNote,
    },
  });

  revalidatePath(`/scores/${data.scoreId}`);
  revalidatePath(`/assets/${score.assetTicker}`);
  return { data: score };
}
