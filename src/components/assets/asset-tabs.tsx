"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";

interface ResearchItem {
  id: string;
  title: string;
  updatedAt: Date;
}

interface ScoreItem {
  id: string;
  compositeScore: number | null;
  manualOverride: boolean;
  framework: { name: string; slug: string };
  scoredAt: Date;
}

interface DecisionItem {
  id: string;
  title: string;
  direction: string;
  status: string;
  outcome: string | null;
  createdAt: Date;
}

type TabKey = "research" | "scores" | "decisions";

interface AssetTabsProps {
  ticker: string;
  research: ResearchItem[];
  scores: ScoreItem[];
  decisions: DecisionItem[];
}

export function AssetTabs({ ticker, research, scores, decisions }: AssetTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("research");

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "research", label: "Research", count: research.length },
    { key: "scores", label: "Scores", count: scores.length },
    { key: "decisions", label: "Decisions", count: decisions.length },
  ];

  return (
    <div>
      <div className="border-b">
        <nav className="-mb-px flex gap-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} <span className="text-xs">({tab.count})</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4" role="tabpanel">
        {activeTab === "research" && <ResearchTab ticker={ticker} research={research} />}
        {activeTab === "scores" && <ScoresTab ticker={ticker} scores={scores} />}
        {activeTab === "decisions" && <DecisionsTab ticker={ticker} decisions={decisions} />}
      </div>
    </div>
  );
}

function ResearchTab({ ticker, research }: { ticker: string; research: ResearchItem[] }) {
  if (research.length === 0) {
    return (
      <EmptyState
        title="No research yet"
        description={`Create your first research artifact for ${ticker}.`}
      />
    );
  }

  return (
    <div className="space-y-2">
      {research.map((r) => (
        <Link
          key={r.id}
          href={`/research/${r.id}`}
          className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
        >
          <span className="text-sm font-medium">{r.title}</span>
          <span className="text-xs text-muted-foreground">{r.updatedAt.toLocaleDateString()}</span>
        </Link>
      ))}
    </div>
  );
}

function ScoresTab({ ticker, scores }: { ticker: string; scores: ScoreItem[] }) {
  if (scores.length === 0) {
    return (
      <EmptyState
        title="No scores yet"
        description={`Score ${ticker} using a framework to see results here.`}
      />
    );
  }

  const grouped = new Map<string, { name: string; scores: ScoreItem[] }>();
  for (const s of scores) {
    const key = s.framework.slug;
    if (!grouped.has(key)) grouped.set(key, { name: s.framework.name, scores: [] });
    grouped.get(key)!.scores.push(s);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([slug, group]) => (
        <div key={slug}>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">{group.name}</h4>
          <div className="space-y-1">
            {group.scores.map((s) => (
              <Link
                key={s.id}
                href={`/scores/${s.id}`}
                className="flex items-center justify-between rounded-md border p-2 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{s.compositeScore?.toFixed(2) ?? "—"}</span>
                  {s.manualOverride && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">override</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{s.scoredAt.toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ ticker, decisions }: { ticker: string; decisions: DecisionItem[] }) {
  if (decisions.length === 0) {
    return (
      <EmptyState
        title="No decisions yet"
        description={`Journal a decision about ${ticker} to see it here.`}
      />
    );
  }

  return (
    <div className="relative ml-3 border-l-2 border-muted pl-6 space-y-4">
      {decisions.map((d) => (
        <div key={d.id} className="relative">
          <div className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-muted bg-background" />
          <Link
            href={`/decisions/${d.id}`}
            className="block rounded-md border p-3 hover:bg-accent/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{d.title}</span>
              <span className={`text-xs font-semibold ${
                d.direction === "bullish" ? "text-green-700 dark:text-green-400"
                : d.direction === "bearish" ? "text-red-700 dark:text-red-400"
                : "text-yellow-700 dark:text-yellow-400"
              }`}>
                {d.direction}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {d.status === "open" && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">Open</span>
              )}
              {d.outcome && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${
                  d.outcome === "correct" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : d.outcome === "incorrect" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                }`}>
                  {d.outcome}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{d.createdAt.toLocaleDateString()}</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
