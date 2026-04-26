'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminAssociationResponse } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import {
  listAdminAssociations,
  restoreAssociation,
  softDeleteAssociation,
} from '@/lib/api/admin';
import { isSystemAdmin } from '@/lib/permissions';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export default function AssociationsAdminPage() {
  const [rows, setRows] = useState<AdminAssociationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  async function refresh(opts?: { search?: string; includeDeleted?: boolean }) {
    const token = await getToken();
    const list = await listAdminAssociations(token, {
      search: (opts?.search ?? search).trim() || undefined,
      includeDeleted: opts?.includeDeleted ?? includeDeleted,
      pageSize: 100,
    });
    setRows(list.data);
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

  async function handleSearch(value: string) {
    setSearch(value);
    try {
      await refresh({ search: value });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleToggleIncludeDeleted(next: boolean) {
    setIncludeDeleted(next);
    try {
      await refresh({ includeDeleted: next });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSoftDelete(row: AdminAssociationResponse) {
    if (!confirm(`"${row.name}" derneği silinsin mi? (Geri alınabilir.)`))
      return;
    setBusyId(row.id);
    try {
      const token = await getToken();
      await softDeleteAssociation(token, row.id);
      toast.success(`"${row.name}" silindi`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(row: AdminAssociationResponse) {
    setBusyId(row.id);
    try {
      const token = await getToken();
      await restoreAssociation(token, row.id);
      toast.success(`"${row.name}" geri yüklendi`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (authorized === false) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const activeCount = rows.filter((r) => !r.deletedAt).length;
  const deletedCount = rows.length - activeCount;

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
          <span className="font-medium text-foreground">Dernekler</span>
        </nav>
        <div className="space-y-1.5">
          <span className="eyebrow">Sistem</span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Dernekler
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {activeCount}
            </span>{' '}
            aktif,{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {deletedCount}
            </span>{' '}
            silinmiş.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Dernek ara…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="includeDeleted"
            checked={includeDeleted}
            onCheckedChange={handleToggleIncludeDeleted}
          />
          <Label htmlFor="includeDeleted" className="text-[12.5px]">
            Silinmişleri göster
          </Label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Dernek bulunamadı.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dernek</TableHead>
                <TableHead>Vergi No</TableHead>
                <TableHead>Şehir / İlçe</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const deleted = !!r.deletedAt;
                return (
                  <TableRow
                    key={r.id}
                    className={deleted ? 'text-muted-foreground' : undefined}
                  >
                    <TableCell className="font-medium text-foreground">
                      {r.name}
                      {r.shortName && (
                        <span className="ml-2 text-[11.5px] text-muted-foreground">
                          ({r.shortName})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {r.taxNumber}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">
                      {r.city} / {r.district}
                    </TableCell>
                    <TableCell>
                      {deleted ? (
                        <Badge variant="outline">Silindi</Badge>
                      ) : r.isActive ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="warning">Pasif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {deleted ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(r)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Geri Yükle
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => handleSoftDelete(r)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          Sil
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
