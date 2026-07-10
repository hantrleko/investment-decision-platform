"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(input: { id: string }) {
  const session = await verifySession();
  if (!session) return { error: "Session expired." };

  await prisma.notification.update({
    where: { id: input.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  return { data: { id: input.id } };
}

export async function markAllNotificationsRead() {
  const session = await verifySession();
  if (!session) return { error: "Session expired." };

  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  return { data: { ok: true } };
}

export async function deleteNotification(input: { id: string }) {
  const session = await verifySession();
  if (!session) return { error: "Session expired." };

  await prisma.notification.delete({ where: { id: input.id } });

  revalidatePath("/notifications");
  return { data: { id: input.id } };
}
