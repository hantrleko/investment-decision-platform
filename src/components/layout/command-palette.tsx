"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  LineChart,
  Gauge,
  ClipboardCheck,
  Boxes,
  FlaskConical,
  Bell,
  Settings,
  Plus,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  keywords: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onOpenChange(false);
      router.push(href);
    };
    return [
      { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, keywords: "home overview", run: go("/dashboard") },
      { id: "research", label: "Go to Research", icon: FileText, keywords: "notes artifacts documents", run: go("/research") },
      { id: "assets", label: "Go to Assets", icon: Boxes, keywords: "tickers equities watchlist", run: go("/assets") },
      { id: "scores", label: "Go to Scores", icon: Gauge, keywords: "framework valuation trend", run: go("/scores") },
      { id: "decisions", label: "Go to Decisions", icon: ClipboardCheck, keywords: "journal thesis outcome", run: go("/decisions") },
      { id: "strategies", label: "Go to Strategies", icon: LineChart, keywords: "recommendation engine", run: go("/strategies") },
      { id: "backtest", label: "Go to Backtest", icon: FlaskConical, keywords: "simulate historical sharpe", run: go("/backtest") },
      { id: "alerts", label: "Go to Alerts", icon: Bell, keywords: "price notification trigger", run: go("/alerts") },
      { id: "notifications", label: "Go to Notifications", icon: Bell, keywords: "inbox unread", run: go("/notifications") },
      { id: "settings", label: "Go to Settings", icon: Settings, keywords: "api token export config", run: go("/settings") },
      { id: "new-research", label: "New Research", hint: "Create", icon: Plus, keywords: "add create research", run: go("/research/new") },
      { id: "new-asset", label: "New Asset", hint: "Create", icon: Plus, keywords: "add create asset ticker", run: go("/assets/new") },
      { id: "new-score", label: "New Score", hint: "Create", icon: Plus, keywords: "add create score", run: go("/scores/new") },
      { id: "new-decision", label: "New Decision", hint: "Create", icon: Plus, keywords: "add create decision", run: go("/decisions/new") },
      { id: "toggle-theme", label: "Toggle light/dark theme", icon: Moon, keywords: "dark light mode appearance", run: () => { toggleTheme(); onOpenChange(false); } },
    ];
  }, [router, onOpenChange, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Keep active index in range.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands, pages, actions…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </li>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => c.run()}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                    i === active ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{c.label}</span>
                  {c.hint && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {c.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
