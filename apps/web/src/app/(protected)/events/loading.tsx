import { Skeleton } from '@/components/ui/skeleton';

export default function EventsLoading() {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </header>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
