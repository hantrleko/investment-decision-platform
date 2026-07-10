import { prisma } from "@/lib/db";
import { ApiTokenManager } from "@/components/settings/api-token-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tokens = await prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Framework configuration, data export, and API access.
      </p>
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Frameworks</h2>
          <p className="text-sm text-muted-foreground">
            Manage scoring framework definitions. Available in a future mission.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Data Export</h2>
          <p className="text-sm text-muted-foreground">
            Export your records as CSV.
          </p>
          <div className="mt-2 flex gap-2 text-sm">
            <a
              href="/api/export/decisions"
              className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
            >
              Export decisions
            </a>
            <a
              href="/api/export/recommendations"
              className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
            >
              Export recommendations
            </a>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">API Access</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Create bearer tokens for the read-only public API
            (<code className="text-xs">/api/v1/assets</code>,{" "}
            <code className="text-xs">/api/v1/decisions</code>). Send as{" "}
            <code className="text-xs">Authorization: Bearer eug_…</code>.
          </p>
          <ApiTokenManager
            tokens={tokens.map((t) => ({
              id: t.id,
              name: t.name,
              scopes: t.scopes,
              lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
              revokedAt: t.revokedAt?.toISOString() ?? null,
              createdAt: t.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
