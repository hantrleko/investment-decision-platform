import { ListSkeleton, Skeleton } from "@/components/shared/skeleton";

export default function ResearchLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <ListSkeleton rows={6} />
    </div>
  );
}
