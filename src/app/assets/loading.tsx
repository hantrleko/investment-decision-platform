import { ListSkeleton, Skeleton } from "@/components/shared/skeleton";

export default function AssetsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <ListSkeleton rows={8} />
    </div>
  );
}
