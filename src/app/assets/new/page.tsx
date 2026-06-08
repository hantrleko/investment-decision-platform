import { AssetForm } from "@/components/assets/asset-form";

export default function NewAssetPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Add New Asset</h1>
      <AssetForm />
    </div>
  );
}
