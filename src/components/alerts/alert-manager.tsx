"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/layout/toast-provider";
import { createAlert, deleteAlert, toggleAlert } from "@/actions/alerts";

interface AssetOption {
  ticker: string;
  name: string;
  lastPrice: number | null;
}

interface AlertRow {
  id: string;
  assetTicker: string;
  assetName: string;
  kind: string;
  threshold: number;
  referencePrice: number | null;
  note: string | null;
  active: boolean;
  lastPrice: number | null;
  lastTriggeredAt: string | null;
}

const KIND_LABEL: Record<string, string> = {
  price_above: "Price ≥",
  price_below: "Price ≤",
  pct_change: "Moves ±%",
};

export function AlertManager({
  assets,
  alerts,
}: {
  assets: AssetOption[];
  alerts: AlertRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState(assets[0]?.ticker ?? "");
  const [kind, setKind] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAlert({
        assetTicker: ticker,
        kind,
        threshold,
        note,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setThreshold("");
      setNote("");
      toast.success(`Alert added for ${ticker}`);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAlert({ id });
      if (res.error) toast.error(res.error);
      else toast.success("Alert deleted");
      router.refresh();
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await toggleAlert({ id, active });
      if (res.error) toast.error(res.error);
      else toast.info(active ? "Alert resumed" : "Alert paused");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Create form */}
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-lg border p-4 md:grid-cols-5 md:items-end"
      >
        <div className="space-y-1">
          <Label htmlFor="alert-ticker">Asset</Label>
          <select
            id="alert-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {assets.length === 0 && <option value="">No assets</option>}
            {assets.map((a) => (
              <option key={a.ticker} value={a.ticker}>
                {a.ticker}
                {a.lastPrice != null ? ` (${a.lastPrice.toFixed(2)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="alert-kind">Condition</Label>
          <select
            id="alert-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="price_above">Price ≥ target</option>
            <option value="price_below">Price ≤ target</option>
            <option value="pct_change">Moves ±% from now</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="alert-threshold">
            {kind === "pct_change" ? "Percent" : "Price"}
          </Label>
          <Input
            id="alert-threshold"
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={kind === "pct_change" ? "10" : "150.00"}
            required
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label htmlFor="alert-note">Note (optional)</Label>
          <Input
            id="alert-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this level"
          />
        </div>
        <Button type="submit" disabled={isPending || !ticker}>
          Add alert
        </Button>
        {error && (
          <p className="text-sm text-red-500 md:col-span-5">{error}</p>
        )}
      </form>

      {/* Existing alerts */}
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Last triggered</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/assets/${a.assetTicker}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.assetTicker}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{KIND_LABEL[a.kind] ?? a.kind}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {a.kind === "pct_change"
                      ? `±${Math.abs(a.threshold)}%`
                      : a.threshold.toFixed(2)}
                    {a.kind === "pct_change" && a.referencePrice != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        (from {a.referencePrice.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {a.lastPrice != null ? a.lastPrice.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.note || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.lastTriggeredAt
                      ? new Date(a.lastTriggeredAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        a.active
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => toggle(a.id, !a.active)}
                    >
                      {a.active ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => remove(a.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
