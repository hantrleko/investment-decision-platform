import { z } from "zod";

const tickerSchema = z
  .string()
  .min(1, "Ticker is required")
  .max(20)
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => /^[A-Z0-9.\-]{1,20}$/.test(v), {
    message: "Ticker may only contain letters, digits, dots, and hyphens",
  });

export const createAssetSchema = z.object({
  ticker: tickerSchema,
  name: z.string().min(1, "Name is required").max(200),
  sector: z.string().max(100).optional().default(""),
  assetType: z.enum(["equity", "crypto", "fx", "commodity", "other"]).default("equity"),
  exchange: z.string().max(50).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  lastPrice: z.number().positive().optional(),
  lastPriceTs: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  priceSource: z.string().max(50).optional(),
});

export const addToWatchlistSchema = z.object({
  assetTicker: z.string().min(1),
  notes: z.string().max(500).optional().default(""),
});

export const removeFromWatchlistSchema = z.object({
  assetTicker: z.string().min(1),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
