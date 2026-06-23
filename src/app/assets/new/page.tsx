import { AssetForm } from "@/components/assets/asset-form";
import { BatchImportForm } from "@/components/assets/batch-import-form";
import { Separator } from "@/components/ui/separator";

export default function NewAssetPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="mb-6 text-2xl font-bold">Add New Asset</h1>
        <AssetForm />
      </div>

      <Separator />

      <div>
        <h2 className="mb-1 text-lg font-semibold">Batch Import</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Import multiple assets at once. Yahoo Finance lookup runs for each new ticker.
        </p>
        <BatchImportForm />
      </div>
    </div>
  );
}
