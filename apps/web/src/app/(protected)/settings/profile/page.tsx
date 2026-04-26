'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import { updateProfile } from '@/lib/api/admin';
import { userRoleLabel } from '@/lib/permissions';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export default function SettingsProfilePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const me = await getMe(token);
        setUser(me);
        setFullName(me.fullName ?? '');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const trimmedName = fullName.trim();
      const trimmedPhone = phone.trim();
      const payload: { fullName?: string; phone?: string | null } = {};
      if (trimmedName && trimmedName !== user?.fullName) {
        payload.fullName = trimmedName;
      }
      if (trimmedPhone) payload.phone = trimmedPhone;
      if (Object.keys(payload).length === 0) {
        toast.info('Değişiklik yok');
        return;
      }
      await updateProfile(token, payload);
      const refreshed = await getMe(token);
      setUser(refreshed);
      toast.success('Profil güncellendi');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

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
      setNewPwd('');
      setConfirmPwd('');
      toast.success('Parola güncellendi');
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

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-5 border-b border-border pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[12px] text-muted-foreground"
        >
          <Link
            href="/settings"
            className="font-medium hover:text-foreground"
          >
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
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
              Kişisel Bilgiler
            </h2>
          </header>
          <form onSubmit={handleSaveProfile} className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+90555…"
                maxLength={32}
              />
              <p className="text-[11.5px] text-muted-foreground">
                E-posta Supabase tarafında yönetilir, buradan değiştirilemez.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </form>
        </section>

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
              Parolan en az 8 karakter olmalı.
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
