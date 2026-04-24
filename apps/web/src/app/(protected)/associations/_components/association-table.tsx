import Link from 'next/link';
import type { AssociationDto } from '@ticketbot/shared-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function AssociationTable({ rows }: { rows: AssociationDto[] }) {
  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dernek</TableHead>
            <TableHead>VKN</TableHead>
            <TableHead>İl / İlçe</TableHead>
            <TableHead className="text-right">Üye</TableHead>
            <TableHead>Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id} className="transition-colors hover:bg-accent/50">
              <TableCell className="font-medium">
                <Link href={`/associations/${a.id}`} className="hover:underline">
                  {a.name}
                </Link>
                {a.shortName && (
                  <span className="ml-2 text-xs text-muted-foreground">({a.shortName})</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{a.taxNumber}</TableCell>
              <TableCell>
                {a.city} / {a.district}
              </TableCell>
              <TableCell className="text-right tabular-nums">{a.memberCount}</TableCell>
              <TableCell>
                <Badge variant={a.isActive ? 'default' : 'secondary'}>
                  {a.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
