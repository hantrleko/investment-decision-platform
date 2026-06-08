"use client";

import { useTransition } from "react";

interface FrameworkPickerProps {
  frameworks: Array<{ id: string; name: string; slug: string; description: string | null }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  excludeSlugs?: string[];
}

export function FrameworkPicker({ frameworks, selectedId, onSelect, excludeSlugs = [] }: FrameworkPickerProps) {
  const available = frameworks.filter((f) => !excludeSlugs.includes(f.slug));

  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">No frameworks available.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {available.map((fw) => (
        <button
          key={fw.id}
          type="button"
          onClick={() => onSelect(fw.id)}
          className={`rounded-lg border p-3 text-left transition-colors ${
            selectedId === fw.id
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "hover:bg-accent/50"
          }`}
        >
          <span className="text-sm font-medium">{fw.name}</span>
          {fw.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fw.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}
