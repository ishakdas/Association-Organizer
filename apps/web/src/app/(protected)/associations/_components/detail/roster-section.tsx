'use client';

import { useMemo, useState } from 'react';
import {
  Briefcase,
  Crown,
  Loader2,
  Mail,
  Phone,
  Send,
  UserMinus,
  Users,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useMembers, useRemoveMember } from '../../_hooks/use-members';
import { useTitles } from '../../_hooks/use-titles';
import { AddMemberDialog } from '../add-member-dialog';
import { TelegramLinkDialog } from './telegram-link-dialog';
import type { MemberResponse, MembershipRole } from '@ticketbot/shared-validation';

const COPY: Record<
  MembershipRole,
  {
    title: string;
    icon: typeof Users;
    empty: string;
    addLabel: string;
    showTitleFilter: boolean;
  }
> = {
  ASSOCIATION_MANAGER: {
    title: 'Başkan',
    icon: Crown,
    empty: 'Bu derneğin aktif başkanı yok.',
    addLabel: 'Başkan değiştir',
    showTitleFilter: false,
  },
  ASSOCIATION_SECRETARY: {
    title: 'Sekreterler',
    icon: Briefcase,
    empty: 'Henüz sekreter atanmadı.',
    addLabel: 'Sekreter ekle',
    showTitleFilter: false,
  },
  ASSOCIATION_MEMBER: {
    title: 'Üyeler',
    icon: Users,
    empty: 'Henüz üye yok.',
    addLabel: 'Üye ekle',
    showTitleFilter: true,
  },
  SYSTEM_ADMIN: {
    title: 'Sistem',
    icon: Users,
    empty: '—',
    addLabel: '',
    showTitleFilter: false,
  },
};

const NO_TITLE = '__all__';

export function RosterSection({
  associationId,
  role,
  canManage,
  variant = 'list',
}: {
  associationId: string;
  role: MembershipRole;
  canManage: boolean;
  variant?: 'list' | 'single';
}) {
  const { data, isLoading, isError, error } = useMembers(associationId, {
    role,
  });
  const removeMutation = useRemoveMember(associationId);
  const { data: titles } = useTitles();
  const [search, setSearch] = useState('');
  const [titleId, setTitleId] = useState<string>(NO_TITLE);
  const [telegramFor, setTelegramFor] = useState<MemberResponse | null>(null);

  const copy = COPY[role];
  const Icon = copy.icon;

  const filtered = useMemo(() => {
    if (!data) return data;
    let rows = data;
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      rows = rows.filter(
        (m) =>
          m.user.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
          (m.user.email ?? '').toLocaleLowerCase('tr-TR').includes(q),
      );
    }
    if (copy.showTitleFilter && titleId !== NO_TITLE) {
      rows = rows.filter((m) => m.title?.id === titleId);
    }
    return rows;
  }, [data, search, titleId, copy.showTitleFilter]);

  function handleRemove(m: MemberResponse) {
    const ok = window.confirm(
      `${m.user.fullName} dernekten çıkarılsın mı? (Üyelik pasifleştirilir, kayıt silinmez.)`,
    );
    if (ok) removeMutation.mutate(m.id);
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            {copy.title}
            {filtered && filtered.length > 0 && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                ({filtered.length})
              </span>
            )}
          </h2>
        </div>
        {canManage && copy.addLabel && (
          <AddMemberDialog
            associationId={associationId}
            defaultRole={role}
            triggerLabel={copy.addLabel}
          />
        )}
      </header>

      {variant === 'list' && data && data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad veya e-posta ara…"
            className="h-9 max-w-[280px]"
          />
          {copy.showTitleFilter && (
            <Select value={titleId} onValueChange={setTitleId}>
              <SelectTrigger className="h-9 max-w-[220px]">
                <SelectValue placeholder="Tüm unvanlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TITLE}>Tüm unvanlar</SelectItem>
                {titles?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2 p-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {isError && (
        <p className="px-5 py-8 text-center text-sm text-destructive">
          Liste yüklenemedi: {error.message}
        </p>
      )}

      {filtered && filtered.length === 0 && (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          {data && data.length === 0 ? copy.empty : 'Filtreye uyan kayıt yok.'}
        </p>
      )}

      {filtered && filtered.length > 0 && variant === 'single' && (
        <div className="px-5 py-5">
          {filtered.slice(0, 1).map((m) => (
            <SingleCard
              key={m.id}
              m={m}
              canManage={canManage}
              onRemove={() => handleRemove(m)}
              onGenerateTelegram={() => setTelegramFor(m)}
              isRemoving={
                removeMutation.isPending && removeMutation.variables === m.id
              }
            />
          ))}
        </div>
      )}

      <TelegramLinkDialog
        associationId={associationId}
        member={telegramFor}
        open={telegramFor !== null}
        onOpenChange={(open) => {
          if (!open) setTelegramFor(null);
        }}
      />

      {filtered && filtered.length > 0 && variant === 'list' && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>İsim</TableHead>
              {copy.showTitleFilter && <TableHead>Unvan</TableHead>}
              <TableHead>İletişim</TableHead>
              <TableHead className="text-right">Katılım</TableHead>
              {canManage && (
                <TableHead className="w-[1%]" aria-label="Eylemler" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const isRemoving =
                removeMutation.isPending && removeMutation.variables === m.id;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.user.fullName}
                  </TableCell>
                  {copy.showTitleFilter && (
                    <TableCell className="text-[13px] text-muted-foreground">
                      {m.title?.name ?? m.customTitle ?? '—'}
                    </TableCell>
                  )}
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
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTelegramFor(m)}
                          aria-label={`${m.user.fullName} için Telegram kodu üret`}
                          title="Telegram bağlantı kodu üret"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(m)}
                          disabled={isRemoving}
                          aria-label={`${m.user.fullName} adlı kişiyi çıkar`}
                        >
                          {isRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function SingleCard({
  m,
  canManage,
  onRemove,
  onGenerateTelegram,
  isRemoving,
}: {
  m: MemberResponse;
  canManage: boolean;
  onRemove: () => void;
  onGenerateTelegram: () => void;
  isRemoving: boolean;
}) {
  const initials = m.user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-background p-5 sm:flex-row sm:items-start">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-semibold tracking-tight text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            {m.user.fullName}
          </h3>
          <Badge variant="success">Aktif</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          {m.user.email && (
            <a
              href={`mailto:${m.user.email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {m.user.email}
            </a>
          )}
          {m.user.phone && (
            <a
              href={`tel:${m.user.phone}`}
              className="inline-flex items-center gap-1.5 font-mono hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
              {m.user.phone}
            </a>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">
          Katılım: {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onGenerateTelegram}>
            <Send className="h-3.5 w-3.5" />
            Telegram kodu
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserMinus className="h-3.5 w-3.5" />
            )}
            Görevden al
          </Button>
        </div>
      )}
    </div>
  );
}
