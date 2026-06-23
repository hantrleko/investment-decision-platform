"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { batchImportAssets, type BatchImportResult } from "@/actions/assets";

export function BatchImportForm() {
  const [isPending, startTransition] = useTransition();
  const [pasteText, setPasteText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result));
    };
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!pasteText.trim() && !csvText.trim()) {
      setError("Paste tickers or upload a CSV");
      return;
    }

    startTransition(async () => {
      const res = await batchImportAssets({ tickers: pasteText, csv: csvText });
      if (res.error || !res.data) {
        setError(res.error || "Import failed");
        return;
      }
      setResult(res.data);
    });
  }

  return (
    <div className="space-y-4">
      {/* Paste tickers */}
      <div className="space-y-2">
        <label htmlFor="paste" className="text-sm font-medium">
          Paste Tickers
        </label>
        <p className="text-xs text-muted-foreground">
          Newline or comma separated (e.g. AAPL, MSFT, NVDA)
        </p>
        <textarea
          id="paste"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          placeholder={"AAPL\nMSFT\nNVDA\nGOOGL"}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* CSV upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Upload CSV</label>
        <p className="text-xs text-muted-foreground">
          CSV with a <code>ticker</code> column header. Other columns ignored.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="w-full text-sm"
        />
        {csvText && (
          <p className="text-xs text-muted-foreground">
            CSV loaded ({csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1} rows)
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" disabled={isPending} onClick={handleSubmit}>
        {isPending ? "Importing..." : "Import Batch"}
      </Button>

      {/* Import summary */}
      {result && (
        <div className="rounded-md border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Import Summary</h3>

          {result.created.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                Created ({result.created.length})
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.created.map((c) => (
                  <li key={c.ticker} className="text-xs">
                    <span className="font-mono">{c.ticker}</span> — {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.skippedExisting.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Skipped — Already Exist ({result.skippedExisting.length})
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.skippedExisting.join(", ")}
              </p>
            </div>
          )}

          {result.failed.length > 0 && (
            <div>
              <p className="text-xs font-medium text-destructive">
                Failed ({result.failed.length})
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.failed.map((f) => (
                  <li key={f.ticker} className="text-xs">
                    <span className="font-mono">{f.ticker}</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.created.length === 0 &&
            result.skippedExisting.length === 0 &&
            result.failed.length === 0 && (
              <p className="text-xs text-muted-foreground">No tickers processed.</p>
            )}
        </div>
      )}
    </div>
  );
}
