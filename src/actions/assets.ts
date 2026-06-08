"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { createAssetSchema, addToWatchlistSchema, removeFromWatchlistSchema } from "@/lib/validators/asset";
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

  const asset = await prisma.asset.create({
    data: {
      ticker: data.ticker,
      name: data.name,
      sector: data.sector || null,
      assetType: data.assetType,
      exchange: data.exchange || null,
      notes: data.notes || null,
      lastPrice: data.lastPrice ?? null,
      lastPriceTs: data.lastPriceTs ?? null,
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
