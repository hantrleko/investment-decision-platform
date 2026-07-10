import { ListSkeleton, Skeleton } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <ListSkeleton rows={5} />
    </div>
  );
}
