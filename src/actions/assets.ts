"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createAssetSchema, addToWatchlistSchema, removeFromWatchlistSchema } from "@/lib/validators/asset";
import { revalidatePath } from "next/cache";

export async function createAsset(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
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
      lastKnownPrice: data.lastKnownPrice ?? null,
      priceDate: data.priceDate ?? null,
    },
  });

  revalidatePath("/assets");
  return { data: asset };
}

export async function addToWatchlist(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
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
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
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
