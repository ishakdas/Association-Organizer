import Link from 'next/link';
import { ArrowUpRight, MapPin, Phone, Users } from 'lucide-react';
import type { AssociationDto } from '@ticketbot/shared-types';
import { Badge } from '@/components/ui/badge';

export function AssociationCard({ association }: { association: AssociationDto }) {
  return (
    <Link
      href={`/associations/${association.id}`}
      className="group relative block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-[2px] rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground group-hover:text-primary">
            {association.name}
          </h3>
          <p className="font-mono text-[11.5px] text-muted-foreground">
            VKN · {association.taxNumber ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={association.isActive ? 'success' : 'outline'}>
            {association.isActive ? 'Aktif' : 'Pasif'}
          </Badge>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-[12.5px] text-muted-foreground sm:grid-cols-3">
        <Meta icon={<MapPin className="h-3.5 w-3.5" />}>
          {association.city} / {association.district}
        </Meta>
        <Meta icon={<Phone className="h-3.5 w-3.5" />}>
          {association.phone ?? '—'}
        </Meta>
        <Meta icon={<Users className="h-3.5 w-3.5" />}>
          <span className="tabular-nums">{association.memberCount}</span> üye
        </Meta>
      </dl>
    </Link>
  );
}

function Meta({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
