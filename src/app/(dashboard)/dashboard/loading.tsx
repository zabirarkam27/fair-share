import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading your workspace"
      className="space-y-7"
    >
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
