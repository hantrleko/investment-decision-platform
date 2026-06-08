import { z } from "zod";

const factorScoreSchema = z.object({
  value: z.number().min(0).max(10),
  note: z.string().max(500).optional(),
});

export const createScoreSchema = z.object({
  frameworkId: z.string().cuid(),
  assetTicker: z.string().min(1),
  researchArtifactId: z.string().cuid().optional(),
  factorScores: z.record(factorScoreSchema),
});

export const overrideCompositeSchema = z.object({
  scoreId: z.string().cuid(),
  overrideValue: z.number().min(0).max(10),
  overrideNote: z.string().min(1, "Override note is required").max(500),
});

export type CreateScoreInput = z.infer<typeof createScoreSchema>;
export type OverrideCompositeInput = z.infer<typeof overrideCompositeSchema>;
