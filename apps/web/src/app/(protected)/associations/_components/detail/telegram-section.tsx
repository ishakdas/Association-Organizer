'use client';


import {
  Briefcase,
  Crown,
  Loader2,
  Mail,
  MessageSquare,
  Unlink,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Separator } from '@/components/ui/separator';
import {
  useMembers,
  useUnlinkMemberTelegram,
  useGenerateMemberTelegramLinkWithEmail,
} from '../../_hooks/use-members';
import type { MemberResponse, MembershipRole } from '@ticketbot/shared-validation';

const ROLE_LABEL: Record<MembershipRole, { label: string; icon: typeof Users }> = {
  ASSOCIATION_MANAGER: { label: 'Başkan', icon: Crown },
  ASSOCIATION_SECRETARY: { label: 'Sekreter', icon: Briefcase },
  ASSOCIATION_MEMBER: { label: 'Üye', icon: Users },
  SYSTEM_ADMIN: { label: 'Sistem', icon: Users },
};

export function TelegramSection({
  associationId,
  canManage,
}: {
  associationId: string;
  canManage: boolean;
}) {
  const { data, isLoading, isError, error } = useMembers(associationId, {});
  const unlinkMutation = useUnlinkMemberTelegram(associationId);
  const sendLinkMutation = useGenerateMemberTelegramLinkWithEmail(associationId);

  const linked = data?.filter((m) => !!m.user.telegramAccount) ?? [];
  const unlinked = data?.filter((m) => !m.user.telegramAccount) ?? [];

  function handleUnlink(m: MemberResponse) {
    const ok = window.confirm(
      `${m.user.fullName} adlı üyenin Telegram bağlantısı kaldırılsın mı?`,
    );
    if (!ok) return;
    unlinkMutation.mutate(m.id);
  }

  function handleSendLink(m: MemberResponse) {
    if (!m.user.email) {
      toast.error(`${m.user.fullName} adlı üyenin kayıtlı e-posta adresi yok`);
      return;
    }
    sendLinkMutation.mutate(
      { membershipId: m.id, email: m.user.email },
      {
        onSuccess: () => {
          toast.success(`${m.user.email} adresine Telegram bağlantı e-postası gönderildi`);
        },
      },
    );
  }

  return (
    <section className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Toplam üye"
          value={data?.length ?? '—'}
          loading={isLoading}
        />
        <SummaryCard
          label="Telegram bağlı"
          value={linked.length}
          loading={isLoading}
          highlight
        />
        <SummaryCard
          label="Bağlantı yok"
          value={unlinked.length}
          loading={isLoading}
        />
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Liste yüklenemedi: {error.message}
        </p>
      )}

      {/* Connected members */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              01
            </span>
            <Separator orientation="vertical" className="h-3" />
            <h2 className="text-[13.5px] font-semibold tracking-tight">
              Bağlı Hesaplar
            </h2>
          </div>
          <Badge variant="success">{isLoading ? '…' : linked.length} bağlı</Badge>
        </header>

        {isLoading && <SkeletonRows />}

        {!isLoading && linked.length === 0 && (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Henüz Telegram hesabı bağlı üye yok.
          </p>
        )}

        {linked.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Üye</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Bağlandı</TableHead>
                {canManage && (
                  <TableHead className="w-[1%]" aria-label="İşlemler" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linked.map((m) => {
                const tg = m.user.telegramAccount!;
                const handle = tg.username ?? tg.firstName ?? 'telegram';
                const isUnlinking =
                  unlinkMutation.isPending && unlinkMutation.variables === m.id;
                const { label: roleLabel, icon: RoleIcon } = ROLE_LABEL[m.role];

                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.user.fullName}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <RoleIcon className="h-3 w-3" />
                        {roleLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-foreground">
                          @{handle}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">
                      {new Date(tg.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlink(m)}
                          disabled={isUnlinking}
                          title="Telegram bağlantısını kaldır"
                          aria-label={`${m.user.fullName} bağlantıyı kaldır`}
                          className="text-destructive hover:text-destructive"
                        >
                          {isUnlinking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlink className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Unconnected members */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              02
            </span>
            <Separator orientation="vertical" className="h-3" />
            <h2 className="text-[13.5px] font-semibold tracking-tight">
              Bağlantısız Üyeler
            </h2>
          </div>
          <Badge variant="outline">{isLoading ? '…' : unlinked.length} bağlantısız</Badge>
        </header>

        {isLoading && <SkeletonRows />}

        {!isLoading && unlinked.length === 0 && (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Tüm üyeler Telegram'a bağlı.
          </p>
        )}

        {unlinked.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Üye</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>İletişim</TableHead>
                {canManage && (
                  <TableHead className="w-[1%]" aria-label="İşlemler" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unlinked.map((m) => {
                const { label: roleLabel, icon: RoleIcon } = ROLE_LABEL[m.role];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.user.fullName}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <RoleIcon className="h-3 w-3" />
                        {roleLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {m.user.email ?? m.user.phone ?? '—'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendLink(m)}
                          disabled={
                            sendLinkMutation.isPending &&
                            sendLinkMutation.variables?.membershipId === m.id
                          }
                          title="Telegram bağlantı e-postası gönder"
                          aria-label={`${m.user.fullName} için Telegram bağlantı e-postası gönder`}
                        >
                          {sendLinkMutation.isPending &&
                          sendLinkMutation.variables?.membershipId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 text-[12px]">Bağlantı gönder</span>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

    </section>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: number | string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-12" />
      ) : (
        <div
          className={`mt-1 text-[22px] font-bold tabular-nums leading-tight ${
            highlight ? 'text-primary' : 'text-foreground'
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-5">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}
