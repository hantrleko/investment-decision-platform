import { z } from "zod";

export const createAssetSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker is required")
    .max(20)
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Name is required").max(200),
  sector: z.string().max(100).optional().default(""),
  assetType: z.enum(["equity", "crypto", "fx", "commodity", "other"]).default("equity"),
  exchange: z.string().max(50).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  lastKnownPrice: z.number().positive().optional(),
  priceDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
});

export const addToWatchlistSchema = z.object({
  assetTicker: z.string().min(1),
  notes: z.string().max(500).optional().default(""),
});

export const removeFromWatchlistSchema = z.object({
  assetTicker: z.string().min(1),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
