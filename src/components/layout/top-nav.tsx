"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/research", label: "Research" },
  { href: "/assets", label: "Assets" },
  { href: "/scores", label: "Scores" },
  { href: "/decisions", label: "Decisions" },
  { href: "/strategies", label: "Strategies" },
  { href: "/backtest", label: "Backtest" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export function TopNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link
          href="/research"
          className="mr-6 text-lg font-bold tracking-tight"
        >
          Eugene Finance
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
              pathname.startsWith("/notifications")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            }`}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
          >
            Sign Out
          </Button>
        </div>
      </div>
      <Separator />
    </header>
  );
}
