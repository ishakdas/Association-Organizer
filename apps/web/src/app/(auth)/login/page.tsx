'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : error.message,
      );
      setLoading(false);
    } else {
      window.location.href = '/associations';
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <FormPanel
        email={email}
        password={password}
        error={error}
        loading={loading}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
      <div aria-hidden className="bg-grid-slate absolute inset-0 opacity-60" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/20"
      />

      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-foreground">
          <span className="text-sm font-extrabold tracking-tight">DO</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">Dernek Organizer</div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-background/60">
            Sicil &amp; Üyelik Platformu
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md space-y-8">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-background/20 bg-background/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />
            Türkiye&apos;nin Dernekleri İçin
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Dernek sekreterliğini,
            <br />
            <span className="text-background/70">tek yerden yönetin.</span>
          </h1>
          <p className="text-sm leading-relaxed text-background/70">
            Sicil kayıtları, üyelik, yönetim kurulu toplantıları ve görevler —
            hepsi tutarlı, denetlenebilir ve hızlı.
          </p>
        </div>

        <ul className="space-y-3 text-sm">
          <Feature
            icon={<Users className="h-4 w-4" />}
            title="Tek kaynakta dernek sicili"
            body="VKN, kuruluş, iletişim ve yönetim verileri tek ekranda."
          />
          <Feature
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Denetim için hazır"
            body="Soft-delete, değişiklik izleri ve rol tabanlı erişim."
          />
        </ul>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[11px] uppercase tracking-widest text-background/50">
        <span>© {new Date().getFullYear()} Dernek Organizer</span>
        <span>TR</span>
      </div>
    </aside>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-background/15 bg-background/5 text-background/80">
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-xs text-background/60">{body}</div>
      </div>
    </li>
  );
}

function FormPanel({
  email,
  password,
  error,
  loading,
  onEmail,
  onPassword,
  onSubmit,
}: {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
      <header className="flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <span className="text-[13px] font-extrabold tracking-tight">DO</span>
          </div>
          <span className="text-sm font-bold tracking-tight">Dernek Organizer</span>
        </div>
      </header>

      <div className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-sm space-y-8 py-10 lg:py-0">
          <div className="space-y-2">
            <span className="eyebrow">Giriş</span>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
              Hesabınıza giriş yapın
            </h2>
            <p className="text-sm text-muted-foreground">
              Kayıtlı e-postanız ve şifrenizle devam edin.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium">
                E-posta
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ad@dernek.com"
                value={email}
                onChange={(e) => onEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Şifre
                </Label>
                <Link
                  href="#"
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  Şifremi unuttum
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => onPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
              >
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  Giriş yap
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-[12px] text-muted-foreground">
            Hesabınız yok mu?{' '}
            <span className="font-medium text-foreground">
              Dernek yöneticinizle iletişime geçin.
            </span>
          </p>
        </div>
      </div>

      <footer className="text-center text-[11px] uppercase tracking-widest text-muted-foreground lg:hidden">
        © {new Date().getFullYear()} Dernek Organizer
      </footer>
    </div>
  );
}
