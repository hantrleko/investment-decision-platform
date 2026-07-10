import { z } from "zod";

export const createAlertSchema = z.object({
  assetTicker: z
    .string()
    .min(1, "Asset is required")
    .transform((v) => v.trim().toUpperCase()),
  kind: z.enum(["price_above", "price_below", "pct_change"]),
  threshold: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Threshold must be a number"),
  note: z.string().max(500).optional().default(""),
});

export const deleteAlertSchema = z.object({
  id: z.string().min(1),
});

export const toggleAlertSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export type CreateAlertInput = z.infer<typeof createAlertSchema>;
