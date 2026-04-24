import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[38%]">Dernek</TableHead>
            <TableHead>VKN</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead className="text-right">Üye</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id} className="relative">
              <TableCell className="relative">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px] bg-primary opacity-0 transition-opacity group-hover:opacity-100"
                />
                <Link
                  href={`/associations/${a.id}`}
                  className="inline-flex flex-col gap-0.5 after:absolute after:inset-0"
                >
                  <span className="text-[14px] font-semibold text-foreground group-hover:text-primary">
                    {a.name}
                  </span>
                  {a.shortName && (
                    <span className="text-[12px] text-muted-foreground">
                      {a.shortName}
                    </span>
                  )}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                {a.taxNumber}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                <span className="text-foreground">{a.city}</span>
                <span className="px-1 text-muted-foreground/50">/</span>
                {a.district}
              </TableCell>
              <TableCell className="text-right text-[13.5px] font-medium tabular-nums">
                {a.memberCount.toLocaleString('tr-TR')}
              </TableCell>
              <TableCell>
                <Badge variant={a.isActive ? 'success' : 'outline'}>
                  {a.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
