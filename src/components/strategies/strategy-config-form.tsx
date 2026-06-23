"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateStrategyConfig } from "@/actions/strategies";

interface ConfigField {
  key: string;
  label: string;
  type: "number" | "boolean";
  description?: string;
}

interface StrategyConfigFormProps {
  slug: string;
  config: Record<string, number | boolean | string>;
  configSchema: ConfigField[];
}

export function StrategyConfigForm({ slug, config, configSchema }: StrategyConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [note, setNote] = useState("");
  const [experimentLabel, setExperimentLabel] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const field of configSchema) {
      v[field.key] = String(config[field.key] ?? "");
    }
    return v;
  });

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateStrategyConfig({
        slug,
        config: values,
        note: note || undefined,
        experimentLabel: experimentLabel || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setNote("");
      setExperimentLabel("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {configSchema.map((field) => (
          <div key={field.key} className="space-y-1">
            <label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </label>
            <input
              id={field.key}
              type={field.type === "number" ? "number" : "text"}
              step={field.type === "number" ? "0.1" : undefined}
              value={values[field.key]}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Optional note + experiment label */}
      <div className="space-y-3 border-t pt-3">
        <div className="space-y-1">
          <label htmlFor="config-note" className="text-sm font-medium">
            Note <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="config-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Lowered buy threshold for testing"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="config-experiment" className="text-sm font-medium">
            Experiment Label <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="config-experiment"
            type="text"
            value={experimentLabel}
            onChange={(e) => setExperimentLabel(e.target.value)}
            placeholder="e.g. exp-2026-06-aggressive"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Configuration saved with history record.</p>}

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}
