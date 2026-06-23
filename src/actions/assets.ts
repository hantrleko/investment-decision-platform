"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { createAssetSchema, addToWatchlistSchema, removeFromWatchlistSchema } from "@/lib/validators/asset";
import { getAssetMetaAndPrice } from "@/lib/marketdata/yahoo";
import { revalidatePath } from "next/cache";

export async function createAsset(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = createAssetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  const existing = await prisma.asset.findUnique({ where: { ticker: data.ticker } });
  if (existing) {
    return { error: `Asset with ticker "${data.ticker}" already exists` };
  }

  // Auto-set lastPriceTs when lastPrice is provided but timestamp is missing
  const lastPriceTs = data.lastPrice != null && !data.lastPriceTs ? new Date() : data.lastPriceTs ?? null;

  const asset = await prisma.asset.create({
    data: {
      ticker: data.ticker,
      name: data.name,
      sector: data.sector || null,
      assetType: data.assetType,
      exchange: data.exchange || null,
      notes: data.notes || null,
      lastPrice: data.lastPrice ?? null,
      lastPriceTs,
      priceSource: data.priceSource ?? null,
    },
  });

  revalidatePath("/assets");
  return { data: asset };
}

export async function addToWatchlist(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = addToWatchlistSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { assetTicker, notes } = parsed.data;

  const asset = await prisma.asset.findUnique({ where: { ticker: assetTicker } });
  if (!asset) {
    return { error: `Asset "${assetTicker}" does not exist` };
  }

  const existing = await prisma.watchlistEntry.findFirst({
    where: { assetTicker },
  });
  if (existing) {
    return { error: "Already on watchlist" };
  }

  const entry = await prisma.watchlistEntry.create({
    data: { assetTicker, notes: notes || null },
  });

  revalidatePath(`/assets/${assetTicker}`);
  revalidatePath("/assets");
  return { data: entry };
}

export async function removeFromWatchlist(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = removeFromWatchlistSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { assetTicker } = parsed.data;

  await prisma.watchlistEntry.deleteMany({ where: { assetTicker } });

  revalidatePath(`/assets/${assetTicker}`);
  revalidatePath("/assets");
  return { data: { assetTicker } };
}

// ─── Batch Import ──────────────────────────────────────────────

export interface BatchImportResult {
  created: Array<{ ticker: string; name: string }>;
  skippedExisting: string[];
  failed: Array<{ ticker: string; error: string }>;
}

function parseTickerList(raw: string): string[] {
  // Accept newline or comma separated tickers
  const parts = raw.split(/[\n,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  // De-duplicate within batch, preserving order
  return Array.from(new Set(parts));
}

function parseCsvTickers(csv: string): string[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Find the ticker column index from the header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  let tickerIdx = header.findIndex((h) => h === "ticker" || h === "symbol");
  if (tickerIdx === -1) tickerIdx = 0; // fallback: first column

  const tickers: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const raw = cols[tickerIdx]?.trim().toUpperCase();
    if (raw) tickers.push(raw);
  }
  return Array.from(new Set(tickers)); // de-duplicate
}

export async function batchImportAssets(input: { tickers?: string; csv?: string }) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  // Collect tickers from both paste and CSV sources
  const tickers: string[] = [];
  if (input.tickers?.trim()) {
    tickers.push(...parseTickerList(input.tickers));
  }
  if (input.csv?.trim()) {
    tickers.push(...parseCsvTickers(input.csv));
  }

  // De-duplicate the combined list
  const unique = Array.from(new Set(tickers));
  if (unique.length === 0) {
    return { error: "No valid tickers provided" };
  }
  if (unique.length > 100) {
    return { error: "Maximum 100 tickers per batch" };
  }

  const result: BatchImportResult = {
    created: [],
    skippedExisting: [],
    failed: [],
  };

  for (const ticker of unique) {
    // Check if already exists
    const existing = await prisma.asset.findUnique({ where: { ticker } });
    if (existing) {
      result.skippedExisting.push(ticker);
      continue;
    }

    // Attempt Yahoo lookup
    let name = ticker; // fallback name
    let exchange: string | null = null;
    let sector: string | null = null;
    let lastPrice: number | null = null;
    let priceSource: string | null = null;

    try {
      const meta = await getAssetMetaAndPrice(ticker);
      if (meta.name) name = meta.name;
      exchange = meta.exchange;
      sector = meta.sector;
      lastPrice = meta.lastPrice;
      if (lastPrice != null) priceSource = "yahoo";
    } catch {
      // Lookup failed — create with ticker only
    }

    try {
      await prisma.asset.create({
        data: {
          ticker,
          name,
          sector,
          exchange,
          lastPrice,
          lastPriceTs: lastPrice != null ? new Date() : null,
          priceSource,
        },
      });
      result.created.push({ ticker, name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create failed";
      result.failed.push({ ticker, error: msg });
    }
  }

  revalidatePath("/assets");
  return { data: result };
}

// ─── Watchlist Bulk Refresh ────────────────────────────────────

export interface BulkRefreshResult {
  updated: Array<{ ticker: string; lastPrice: number }>;
  failed: Array<{ ticker: string; error: string }>;
  skipped: string[];
}

export async function bulkRefreshWatchlistPrices() {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const entries = await prisma.watchlistEntry.findMany({
    select: { asset: { select: { ticker: true } } },
  });

  const tickers = entries.map((e) => e.asset.ticker);
  if (tickers.length === 0) {
    return { data: { updated: [], failed: [], skipped: [] } as BulkRefreshResult };
  }

  const result: BulkRefreshResult = {
    updated: [],
    failed: [],
    skipped: [],
  };

  for (const ticker of tickers) {
    try {
      const meta = await getAssetMetaAndPrice(ticker);
      if (meta.lastPrice == null) {
        result.skipped.push(ticker);
        continue;
      }
      await prisma.asset.update({
        where: { ticker },
        data: {
          lastPrice: meta.lastPrice,
          lastPriceTs: new Date(),
          priceSource: "yahoo",
        },
      });
      result.updated.push({ ticker, lastPrice: meta.lastPrice });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refresh failed";
      result.failed.push({ ticker, error: msg });
    }
  }

  revalidatePath("/assets");
  return { data: result };
}
