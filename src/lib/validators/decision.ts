import { z } from "zod";

export const createDecisionSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  thesis: z.string().min(1, "Thesis is required").max(5000),
  researchArtifactIds: z.array(z.string().cuid()).default([]),
  scoreIds: z.array(z.string().cuid()).default([]),
});

export const recordOutcomeSchema = z.object({
  decisionId: z.string().cuid(),
  outcome: z.enum(["correct", "incorrect", "partial"]),
  outcomeNote: z.string().max(2000).optional().default(""),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type RecordOutcomeInput = z.infer<typeof recordOutcomeSchema>;
