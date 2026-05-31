import { Skeleton } from '@/components/ui/skeleton';

export default function AssociationDetailLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <header className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
