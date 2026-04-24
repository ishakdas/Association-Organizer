import Link from 'next/link';
import { MapPin, Phone, Users } from 'lucide-react';
import type { AssociationDto } from '@ticketbot/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function AssociationCard({ association }: { association: AssociationDto }) {
  return (
    <Link href={`/associations/${association.id}`} className="block">
      <Card className="transition-colors hover:border-ring/40 hover:shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-start justify-between gap-2">
            <span className="truncate">{association.name}</span>
            <Badge variant={association.isActive ? 'default' : 'secondary'}>
              {association.isActive ? 'Aktif' : 'Pasif'}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">VKN: {association.taxNumber}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {association.city} / {association.district}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            {association.phone}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {association.memberCount} üye
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
