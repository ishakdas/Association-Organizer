import { Skeleton } from '@/components/ui/skeleton';

export default function AssociationsLoading() {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </header>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-3 w-48" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={i < 5 ? 'border-b border-border/70 px-4 py-4' : 'px-4 py-4'}
          >
            <div className="flex items-center gap-6">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="h-5 w-14 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
