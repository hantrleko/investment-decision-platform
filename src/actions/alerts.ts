"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  createAlertSchema,
  deleteAlertSchema,
  toggleAlertSchema,
} from "@/lib/validators/alert";
import { revalidatePath } from "next/cache";

export async function createAlert(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = createAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { assetTicker, kind, threshold, note } = parsed.data;

  const asset = await prisma.asset.findUnique({ where: { ticker: assetTicker } });
  if (!asset) {
    return { error: `Asset "${assetTicker}" does not exist` };
  }

  if ((kind === "price_above" || kind === "price_below") && threshold <= 0) {
    return { error: "Price threshold must be greater than 0" };
  }
  if (kind === "pct_change" && threshold === 0) {
    return { error: "Percent-change threshold cannot be 0" };
  }

  const alert = await prisma.alert.create({
    data: {
      assetTicker,
      kind,
      threshold,
      note: note || null,
      // Capture current price as the reference for pct_change alerts.
      referencePrice: kind === "pct_change" ? asset.lastPrice : null,
    },
  });

  revalidatePath(`/assets/${assetTicker}`);
  revalidatePath("/alerts");
  return { data: alert };
}

export async function deleteAlert(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = deleteAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const alert = await prisma.alert.findUnique({ where: { id: parsed.data.id } });
  if (!alert) return { error: "Alert not found" };

  await prisma.alert.delete({ where: { id: parsed.data.id } });

  revalidatePath(`/assets/${alert.assetTicker}`);
  revalidatePath("/alerts");
  return { data: { id: parsed.data.id } };
}

export async function toggleAlert(input: unknown) {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const parsed = toggleAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const alert = await prisma.alert.update({
    where: { id: parsed.data.id },
    data: { active: parsed.data.active },
  });

  revalidatePath(`/assets/${alert.assetTicker}`);
  revalidatePath("/alerts");
  return { data: alert };
}
