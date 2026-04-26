'use client';

import { Users, UserMinus, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembers, useRemoveMember } from '../_hooks/use-members';
import { AddMemberDialog } from './add-member-dialog';
import type { MemberResponse, MembershipRole } from '@ticketbot/shared-validation';

const ROLE_LABEL: Record<MembershipRole, string> = {
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
  ASSOCIATION_MANAGER: 'Başkan',
  ASSOCIATION_SECRETARY: 'Sekreter',
  ASSOCIATION_MEMBER: 'Üye',
};

const ROLE_VARIANT: Record<
  MembershipRole,
  'default' | 'secondary' | 'outline' | 'success'
> = {
  SYSTEM_ADMIN: 'default',
  ASSOCIATION_MANAGER: 'success',
  ASSOCIATION_SECRETARY: 'default',
  ASSOCIATION_MEMBER: 'outline',
};

export function MembersCard({ associationId }: { associationId: string }) {
  const { data: members, isLoading, isError, error } = useMembers(associationId);
  const removeMutation = useRemoveMember(associationId);

  function handleRemove(member: MemberResponse) {
    const ok = window.confirm(
      `${member.user.fullName} dernekten çıkarılsın mı? (Üyelik pasifleştirilir, kayıt silinmez.)`,
    );
    if (ok) removeMutation.mutate(member.id);
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Üyeler
            {members && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                ({members.length})
              </span>
            )}
          </h2>
        </div>
        <AddMemberDialog associationId={associationId} />
      </header>

      {isLoading && (
        <div className="space-y-2 p-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {isError && (
        <p className="px-5 py-8 text-center text-sm text-destructive">
          Üyeler yüklenemedi: {error.message}
        </p>
      )}

      {members && members.length === 0 && (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          Henüz üye yok. Sağ üstten ilk kişiyi ekleyin.
        </p>
      )}

      {members && members.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>İsim</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Unvan</TableHead>
              <TableHead>İletişim</TableHead>
              <TableHead className="text-right">Katılım</TableHead>
              <TableHead className="w-[1%]" aria-label="Eylemler" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isRemoving =
                removeMutation.isPending && removeMutation.variables === m.id;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.user.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[m.role]}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {m.title?.name ?? m.customTitle ?? '—'}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {m.user.email && (
                      <span className="block">{m.user.email}</span>
                    )}
                    {m.user.phone && (
                      <span className="block font-mono text-[12px]">
                        {m.user.phone}
                      </span>
                    )}
                    {!m.user.email && !m.user.phone && '—'}
                  </TableCell>
                  <TableCell className="text-right text-[12.5px] text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(m)}
                      disabled={isRemoving}
                      aria-label={`${m.user.fullName} adlı üyeyi çıkar`}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1.5">Çıkar</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
