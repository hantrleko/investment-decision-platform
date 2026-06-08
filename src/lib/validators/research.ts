import { z } from "zod";

export const createResearchSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  contentType: z.enum(["rich-text", "markdown", "note"]).default("rich-text"),
  tags: z.string().default(""),
  assetTicker: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().max(20).or(z.literal(""))),
});

export const updateResearchSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1, "Title is required").max(500).optional(),
  content: z.string().min(1, "Content is required").optional(),
  contentType: z.enum(["rich-text", "markdown", "note"]).optional(),
  tags: z.string().optional(),
  assetTicker: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().max(20).or(z.literal("")))
    .optional(),
});

export const deleteResearchSchema = z.object({
  id: z.string().cuid(),
});

export type CreateResearchInput = z.infer<typeof createResearchSchema>;
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
