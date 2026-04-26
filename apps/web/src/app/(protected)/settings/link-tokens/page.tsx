'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminLinkTokenResponse } from '@ticketbot/shared-validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import { deleteLinkToken, listLinkTokens } from '@/lib/api/admin';
import { isSystemAdmin } from '@/lib/permissions';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LinkTokensPage() {
  const [rows, setRows] = useState<AdminLinkTokenResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  async function refresh() {
    const token = await getToken();
    const list = await listLinkTokens(token);
    setRows(list);
  }

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const me = await getMe(token);
        if (!isSystemAdmin(me)) {
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDelete(row: AdminLinkTokenResponse) {
    if (!confirm(`${row.userFullName} için açık kod silinsin mi?`)) return;
    setBusyId(row.id);
    try {
      const token = await getToken();
      await deleteLinkToken(token, row.id);
      toast.success('Kod silindi');
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  if (authorized === false) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const expiredCount = rows.filter((r) => r.isExpired).length;
  const activeCount = rows.length - expiredCount;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-5 border-b border-border pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[12px] text-muted-foreground"
        >
          <Link href="/settings" className="font-medium hover:text-foreground">
            Ayarlar
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Bağlantı Kodları</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <span className="eyebrow">Sistem</span>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              Telegram Bağlantı Kodları
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {activeCount}
              </span>{' '}
              aktif,{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {expiredCount}
              </span>{' '}
              süresi dolmuş.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Yenile
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Açık kod yok.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Oluşturuldu</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.isExpired ? 'text-muted-foreground' : undefined}
                >
                  <TableCell className="font-medium text-foreground">
                    {r.userFullName}
                    {r.userEmail && (
                      <div className="text-[11.5px] text-muted-foreground">
                        {r.userEmail}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">
                    {r.token.slice(0, 12)}…
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {formatDate(r.expiresAt)}
                  </TableCell>
                  <TableCell>
                    {r.isExpired ? (
                      <Badge variant="outline">Süresi doldu</Badge>
                    ) : (
                      <Badge variant="warning">Aktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleDelete(r)}
                      disabled={busyId === r.id}
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Sil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
