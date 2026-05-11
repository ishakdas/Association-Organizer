'use client';

// Next.js 15 prerender rejects `useSearchParams()` in a Client Component
// unless wrapped in <Suspense>. Reset-password depends on URL params and
// runs only after auth callback, so skip static prerender.
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { clearTempPasswordFlag } from '../../../lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Open-redirect protection: same rules as the auth callbacks. Fallback
// is caller-provided since this page serves both first-time set
// (→ /onboarding) and standalone reset (→ /login).
function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Magic-link first-time set lands with ?next=/onboarding. Standalone
  // reset (from /login → resetPasswordForEmail) lands with no next, so
  // we route the user back to /login to sign in with the fresh password.
  const next = safeNext(searchParams.get('next'), '/login');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
      else router.replace('/login');
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Clear the mustChangePassword flag so the login flow recognizes the user as active
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await clearTempPasswordFlag(session.access_token);
      }
    } catch {
      // Non-blocking — proceed even if clearing flag fails
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.replace(next), 2500);
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm space-y-8 py-10 lg:py-0">
            {done ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">Şifreniz güncellendi</h3>
                  <p className="text-[13px] text-muted-foreground">
                    Giriş sayfasına yönlendiriliyorsunuz…
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="eyebrow">Şifre Sıfırlama</span>
                  <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
                    Yeni şifrenizi belirleyin
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    En az 8 karakter uzunluğunda bir şifre seçin.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-[13px] font-medium">
                      Yeni Şifre
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-[13px] font-medium">
                      Şifre Tekrar
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      disabled={loading}
                      minLength={8}
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
                        Güncelleniyor…
                      </>
                    ) : (
                      <>
                        Şifremi Güncelle
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        <footer className="text-center text-[11px] uppercase tracking-widest text-muted-foreground lg:hidden">
          © {new Date().getFullYear()} Dernek Organizer
        </footer>
      </div>
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

      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background text-foreground">
            <span className="text-[13px] font-extrabold tracking-tight">DO</span>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-background">
              Dernek Organizer
            </div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-background/60">
              Sicil &amp; Üyelik
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-background/20 bg-background/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          Güvenli Şifre Sıfırlama
        </span>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Hesabınızı güvende tutun.
        </h1>
        <p className="text-sm leading-relaxed text-background/70">
          Yeni şifrenizi belirleyin ve hesabınıza giriş yapmaya devam edin.
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[11px] uppercase tracking-widest text-background/50">
        <span>© {new Date().getFullYear()} Dernek Organizer</span>
        <span>TR</span>
      </div>
    </aside>
  );
}
