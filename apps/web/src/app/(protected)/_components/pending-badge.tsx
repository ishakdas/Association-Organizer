'use client';

import { usePendingRegistrationsCount } from '../admin/pending-registrations/_hooks/use-pending-count';

export function PendingBadge() {
  const count = usePendingRegistrationsCount();
  if (count === 0) return null;
  return (
    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
      {count}
    </span>
  );
}
