'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import { getAssociation } from '@/lib/api/associations';
import { clearTempPasswordFlag } from '@/lib/api/auth';
import { userRoleLabel, activeMemberships } from '@/lib/permissions';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export default function SettingsProfilePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [associationName, setAssociationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPwd, setSavingPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const me = await getMe(token);
        setUser(me);
        const active = activeMemberships(me);
        if (active.length > 0) {
          try {
            const assoc = await getAssociation(token, active[0].associationId);
            setAssociationName(assoc.name);
          } catch {
            // non-blocking
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      toast.error('Parola en az 8 karakter olmalı');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Parolalar eşleşmiyor');
      return;
    }
    setSavingPwd(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: newPwd });
      if (err) throw err;

      try {
        const token = await getToken();
        await clearTempPasswordFlag(token);
      } catch {
        // Non-blocking
      }

      setNewPwd('');
      setConfirmPwd('');
      toast.success('Parola güncellendi');
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  const memberships = activeMemberships(user);
  const primaryMembership = memberships[0] ?? null;

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
          <span className="font-medium text-foreground">Hesabım</span>
        </nav>
        <div className="space-y-1.5">
          <span className="eyebrow">Profil</span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Hesabım
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.email}
            {userRoleLabel(user) && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {userRoleLabel(user)}
              </span>
            )}
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Şube Bilgisi — readonly */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
                Şube Bilgisi
              </h2>
            </div>
          </header>
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Ad Soyad</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13.5px] text-foreground">
                {user?.fullName ?? '—'}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">E-posta</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13.5px] text-foreground">
                {user?.email ?? '—'}
              </div>
            </div>
            {primaryMembership && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Şube</Label>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13.5px] text-foreground">
                    {associationName ?? primaryMembership.associationId}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Rol</Label>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13.5px] text-foreground">
                    {userRoleLabel(user) ?? '—'}
                  </div>
                </div>
              </>
            )}
            <p className="text-[11.5px] text-muted-foreground">
              Şube bilgileri yalnızca yönetici tarafından değiştirilebilir.
            </p>
          </div>
        </section>

        {/* Parola */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
              Parola
            </h2>
          </header>
          <form onSubmit={handleChangePassword} className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="newPwd">Yeni Parola</Label>
              <Input
                id="newPwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPwd">Yeni Parola (Tekrar)</Label>
              <Input
                id="confirmPwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Parola en az 8 karakter olmalı.
            </p>
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={savingPwd}>
                {savingPwd ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingPwd ? 'Güncelleniyor…' : 'Parolayı Değiştir'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
