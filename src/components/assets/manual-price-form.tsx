"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ManualPriceFormProps {
  ticker: string;
}

export function ManualPriceForm({ ticker }: ManualPriceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(price);
    if (isNaN(value) || value <= 0) {
      setError("Enter a valid positive price");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/assets/${ticker}/manual-price`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: value }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Save failed");
          return;
        }
        router.refresh();
      } catch {
        setError("Network error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="manual-price" className="text-xs font-medium">Manual price</label>
        <input
          id="manual-price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 150.25"
          className="w-28 rounded-md border bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Saving..." : "Set"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
