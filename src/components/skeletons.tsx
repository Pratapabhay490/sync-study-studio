import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-64 rounded-3xl sm:h-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

export function SubjectsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading subjects">
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function TopicListSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading topics">
      <Skeleton className="h-32 rounded-3xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5, height = "h-16" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2.5" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`${height} rounded-2xl`} />
      ))}
    </div>
  );
}
