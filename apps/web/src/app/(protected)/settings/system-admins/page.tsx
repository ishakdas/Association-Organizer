'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserResponse } from '@ticketbot/shared-validation';
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
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import {
  listAdminUsers,
  listSystemAdmins,
  promoteSystemAdmin,
  revokeSystemAdmin,
} from '@/lib/api/admin';
import { isSystemAdmin } from '@/lib/permissions';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export default function SystemAdminsPage() {
  const [admins, setAdmins] = useState<AdminUserResponse[]>([]);
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  async function refresh() {
    const token = await getToken();
    const [adm, list] = await Promise.all([
      listSystemAdmins(token),
      listAdminUsers(token, { pageSize: 100 }),
    ]);
    setAdmins(adm);
    setUsers(list.data);
  }

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const meUser = await getMe(token);
        setMe({ id: meUser.id });
        if (!isSystemAdmin(meUser)) {
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
      const token = await getToken();
      const list = await listAdminUsers(token, {
        search: value.trim() || undefined,
        pageSize: 100,
      });
      setUsers(list.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handlePromote(user: AdminUserResponse) {
    setBusyId(user.id);
    try {
      const token = await getToken();
      const res = await promoteSystemAdmin(token, user.id);
      if (res.alreadyAdmin) toast.info('Zaten sistem yöneticisi');
      else toast.success(`${user.fullName} sistem yöneticisi olarak atandı`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(user: AdminUserResponse) {
    if (!confirm(`${user.fullName} sistem yöneticiliğinden kaldırılsın mı?`))
      return;
    setBusyId(user.id);
    try {
      const token = await getToken();
      await revokeSystemAdmin(token, user.id);
      toast.success(`${user.fullName} yönetici rolünden çıkarıldı`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const promotable = useMemo(
    () => users.filter((u) => !u.isSystemAdmin),
    [users],
  );

  if (authorized === false) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

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
          <span className="font-medium text-foreground">Sistem Yöneticileri</span>
        </nav>
        <div className="space-y-1.5">
          <span className="eyebrow">Sistem</span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Sistem Yöneticileri
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {admins.length}
            </span>{' '}
            aktif yönetici. Son yöneticiyi kaldıramazsın.
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Aktif Yöneticiler
          </h2>
          <Badge variant="outline">{admins.length}</Badge>
        </header>
        {loading ? (
          <TableSkeleton />
        ) : admins.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Yönetici yok.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">
                    {u.fullName}
                    {me?.id === u.id && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        (sen)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {u.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {u.phone ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleRevoke(u)}
                      disabled={busyId === u.id || me?.id === u.id}
                      title={
                        me?.id === u.id
                          ? 'Kendi yetkini kaldıramazsın'
                          : 'Yöneticiliği kaldır'
                      }
                    >
                      {busyId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5" />
                      )}
                      Kaldır
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <ShieldPlus className="h-4 w-4" />
            Yönetici Olarak Ata
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Kullanıcı ara…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </header>
        {loading ? (
          <TableSkeleton />
        ) : promotable.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            {search ? 'Eşleşen kullanıcı yok' : 'Atanacak kullanıcı yok'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotable.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">
                    {u.fullName}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {u.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {u.phone ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handlePromote(u)}
                      disabled={busyId === u.id}
                    >
                      {busyId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldPlus className="h-3.5 w-3.5" />
                      )}
                      Yönetici Yap
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
