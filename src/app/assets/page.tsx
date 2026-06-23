import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WatchlistTable } from "@/components/assets/watchlist-table";
import { WatchlistRefreshButton } from "@/components/assets/watchlist-refresh-button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AssetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || "";

  const assets = q
    ? await prisma.asset.findMany({
        where: {
          OR: [
            { ticker: { contains: q } },
            { name: { contains: q } },
          ],
        },
        orderBy: { ticker: "asc" },
        select: { ticker: true, name: true, sector: true, assetType: true },
      })
    : await prisma.asset.findMany({
        orderBy: { ticker: "asc" },
        select: { ticker: true, name: true, sector: true, assetType: true },
      });

  const watchlistEntries = await prisma.watchlistEntry.findMany({
    include: { asset: { select: { ticker: true, name: true, sector: true, lastPrice: true, lastPriceTs: true, priceSource: true } } },
    orderBy: { addedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assets</h1>
        <Link href="/assets/new">
          <Button>Add Asset</Button>
        </Link>
      </div>

      {/* Search */}
      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by ticker or name..."
          className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {/* Watchlist */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <WatchlistRefreshButton count={watchlistEntries.length} />
        </div>
        <WatchlistTable entries={watchlistEntries.map((e) => ({
          assetTicker: e.assetTicker,
          asset: {
            ticker: e.asset.ticker,
            name: e.asset.name,
            sector: e.asset.sector,
            lastPrice: e.asset.lastPrice,
            lastPriceTs: e.asset.lastPriceTs,
            priceSource: e.asset.priceSource,
          },
          notes: e.notes,
          addedAt: e.addedAt,
        }))} />
      </section>

      <Separator />

      {/* All assets */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Assets ({assets.length})</h2>
        {assets.length === 0 ? (
          <EmptyState
            title={q ? "No assets found" : "No assets yet"}
            description={q ? "Try a different search term" : "Add your first asset to get started"}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Ticker</th>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Sector</th>
                <th className="pb-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.ticker} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="py-2 pr-4">
                    <Link href={`/assets/${a.ticker}`} className="text-primary hover:underline font-medium">
                      {a.ticker}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{a.sector || "—"}</td>
                  <td className="py-2 text-muted-foreground">{a.assetType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
