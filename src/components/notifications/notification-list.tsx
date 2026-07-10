"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/layout/toast-provider";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/actions/notifications";

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  alert: "Alert",
  recommendation: "Recommendation",
  score: "Score",
  job: "Job",
};

export function NotificationList({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const unread = notifications.filter((n) => !n.read).length;

  function handleRead(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await markNotificationRead({ id });
      setBusyId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await deleteNotification({ id });
      setBusyId(null);
      router.refresh();
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No notifications yet. Alerts and scheduled scans will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {unread} unread · {notifications.length} total
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || unread === 0}
          onClick={handleMarkAll}
        >
          Mark all read
        </Button>
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border p-3 ${
              n.read ? "opacity-60" : "bg-accent/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  <span className="font-medium">{n.title}</span>
                </div>
                {n.body && (
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                  {n.link && (
                    <>
                      {" · "}
                      <Link
                        href={n.link}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === n.id}
                    onClick={() => handleRead(n.id)}
                  >
                    Read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === n.id}
                  onClick={() => handleDelete(n.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
