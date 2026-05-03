import { MapPin, MoveRight, Users } from 'lucide-react';
import type { AssociationDto } from '@ticketbot/shared-types';
import { Badge } from '@/components/ui/badge';

interface AssociationCardProps {
  association: AssociationDto;
  onClick: (id: string) => void;
  loading?: boolean;
}

export function AssociationCard({ association, onClick, loading }: AssociationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(association.id)}
      disabled={loading}
      className="group relative w-full cursor-pointer rounded-xl border border-border bg-card p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground group-hover:text-primary">
            {association.name}
          </h3>
          {association.shortName && (
            <p className="text-[11.5px] text-muted-foreground">{association.shortName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={association.isActive ? 'success' : 'outline'}>
            {association.isActive ? 'Aktif' : 'Pasif'}
          </Badge>
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <MoveRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[12.5px] text-muted-foreground">
        <Meta icon={<MapPin className="h-3.5 w-3.5" />}>
          {association.city} / {association.district}
        </Meta>
        <Meta icon={<Users className="h-3.5 w-3.5" />}>
          <span className="tabular-nums">{association.memberCount}</span> üye
        </Meta>
      </dl>
    </button>
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
