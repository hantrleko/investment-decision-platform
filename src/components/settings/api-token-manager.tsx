"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiToken, revokeApiToken } from "@/actions/api-tokens";

interface TokenRow {
  id: string;
  name: string;
  scopes: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiTokenManager({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("read");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    startTransition(async () => {
      const res = await createApiToken({ name, scopes });
      if (res.error) {
        setError(res.error);
        return;
      }
      setCreated(res.data!.plaintext);
      setName("");
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      await revokeApiToken({ id });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="tok-name">Token name</Label>
          <Input
            id="tok-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI export job"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tok-scopes">Scopes</Label>
          <select
            id="tok-scopes"
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="read">read (all)</option>
            <option value="read:assets">read:assets</option>
            <option value="read:decisions">read:decisions</option>
          </select>
        </div>
        <Button type="submit" disabled={isPending || !name}>
          Create token
        </Button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {created && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">
            Copy this token now — it will not be shown again:
          </p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-xs">
            {created}
          </code>
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API tokens yet.</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <span className="font-medium">{t.name}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  ({t.scopes})
                </span>
                {t.revokedAt && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                    revoked
                  </span>
                )}
                <div className="text-xs text-muted-foreground">
                  {t.lastUsedAt
                    ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                    : "Never used"}
                </div>
              </div>
              {!t.revokedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => revoke(t.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
