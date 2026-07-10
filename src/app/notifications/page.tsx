import { prisma } from "@/lib/db";
import { NotificationList } from "@/components/notifications/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <NotificationList
        notifications={notifications.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.readAt != null,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
