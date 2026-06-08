import Link from "next/link";

interface WatchlistEntry {
  assetTicker: string;
  asset: {
    ticker: string;
    name: string;
    sector: string | null;
    lastPrice: number | null;
    lastPriceTs: Date | null;
    priceSource: string | null;
  };
  notes: string | null;
  addedAt: Date;
}

interface WatchlistTableProps {
  entries: WatchlistEntry[];
}

export function WatchlistTable({ entries }: WatchlistTableProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No assets on watchlist. Add assets from their detail page.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 pr-4 font-medium">Ticker</th>
          <th className="pb-2 pr-4 font-medium">Name</th>
          <th className="pb-2 pr-4 font-medium">Sector</th>
          <th className="pb-2 pr-4 font-medium font-mono">Price</th>
          <th className="pb-2 pr-4 font-medium">Updated</th>
          <th className="pb-2 font-medium">Notes</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.assetTicker} className="border-b last:border-0">
            <td className="py-2 pr-4">
              <Link href={`/assets/${e.assetTicker}`} className="text-primary hover:underline font-medium">
                {e.assetTicker}
              </Link>
            </td>
            <td className="py-2 pr-4">{e.asset.name}</td>
            <td className="py-2 pr-4 text-muted-foreground">{e.asset.sector || "—"}</td>
            <td className={`py-2 pr-4 font-mono ${e.asset.lastPrice == null ? "text-muted-foreground" : ""}`}>
              {e.asset.lastPrice != null ? `$${e.asset.lastPrice.toFixed(2)}` : "—"}
            </td>
            <td className={`py-2 pr-4 ${e.asset.lastPriceTs == null ? "text-muted-foreground" : ""}`}>
              {e.asset.lastPriceTs
                ? `${e.asset.lastPriceTs.toLocaleDateString()}${e.asset.priceSource ? ` (${e.asset.priceSource})` : ""}`
                : "—"}
            </td>
            <td className="py-2 text-muted-foreground">{e.notes || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
