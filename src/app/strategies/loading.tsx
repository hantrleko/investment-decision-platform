import { StatCardsSkeleton, Skeleton } from "@/components/shared/skeleton";

export default function StrategiesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <StatCardsSkeleton count={3} />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
