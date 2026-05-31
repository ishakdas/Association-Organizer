import { Skeleton } from '@/components/ui/skeleton';

export default function TasksLoading() {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32" />
      </header>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
