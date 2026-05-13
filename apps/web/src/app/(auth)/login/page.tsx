'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Clock, Loader2, MailQuestion, Sparkles, Users, XCircle } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { checkBranchEmail, requestBranchRegistration } from '../../../lib/api/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { getProvinceNames, getDistricts } from '@/lib/turkey-locations';

// Next.js 15 requires <Suspense> around any client component that reads
// useSearchParams() — otherwise the prerender step bails out and fails
// the build.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get('error');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="order-2 flex flex-col bg-card px-6 py-10 sm:px-10 lg:order-1 lg:px-14 lg:py-12">
        <header className="flex items-center justify-between lg:hidden">
          <Brand />
        </header>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm space-y-8 py-10 lg:py-0">
            <div className="space-y-2">
              <span className="eyebrow">Giriş</span>
              <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
                Hesabınıza giriş yapın
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Genel Başkan, Şube Başkanı ve Sekreter aynı yerden giriş yapar.
              </p>
            </div>

            {callbackError === 'auth_callback_failed' && (
              <div
                role="alert"
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
              >
                Şifre sıfırlama bağlantısının süresi dolmuş veya geçersiz. Lütfen aşağıdan tekrar
                isteyin.
              </div>
            )}

            <AdminLoginPanel />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                <span className="bg-card px-3 text-muted-foreground">veya</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setBranchDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Yeni Dernek Ekle
            </Button>
          </div>
        </div>

        <footer className="text-center text-[11px] uppercase tracking-widest text-muted-foreground lg:hidden">
          © {new Date().getFullYear()} Dernek Organizer
        </footer>
      </div>
      <BrandPanel />

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Dernek Başvurusu</DialogTitle>
            <DialogDescription>
              E-posta adresinizi girin. Sistemde kayıtlı değilse başvuru formu açılır.
            </DialogDescription>
          </DialogHeader>
          {branchDialogOpen && (
            <BranchLoginPanel onClose={() => setBranchDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminLoginPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  function startCooldown() {
    setResetCooldown(60);
    const interval = setInterval(() => {
      setResetCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

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
      window.location.href = '/dashboard';
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Şifre sıfırlama için e-posta adresinizi girin.');
      return;
    }
    if (resetLoading || resetCooldown > 0) return;
    setResetLoading(true);
    setError(null);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/reset-password`,
    });
    setResetLoading(false);
    setResetSent(true);
    startCooldown();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="admin-email" className="text-[13px] font-medium">
          E-posta
        </Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          placeholder="ad@dernek.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="admin-password" className="text-[13px] font-medium">
            Şifre
          </Label>
          <button
            type="button"
            tabIndex={-1}
            onClick={handleResetPassword}
            disabled={resetLoading || resetCooldown > 0}
            className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {resetCooldown > 0 ? `Tekrar gönder (${resetCooldown}s)` : 'Şifremi unuttum'}
          </button>
        </div>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {resetSent && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-700"
        >
          Şifre sıfırlama bağlantısı <strong>{email}</strong> adresine gönderildi. Gelen kutunuzu kontrol edin.
        </div>
      )}

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
  );
}

type BranchStep =
  | 'email'
  | 'checking'
  | 'already_registered'
  | 'no_password'
  | 'register'
  | 'pending'
  | 'rejected';

function BranchLoginPanel({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<BranchStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  const provinces = getProvinceNames();

  function startResetCooldown() {
    setResetCooldown(60);
    const interval = setInterval(() => {
      setResetCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }
  const districts = city ? getDistricts(city) : [];

  function handleCityChange(value: string) {
    setCity(value);
    setDistrict('');
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStep('checking');

    try {
      const result = await checkBranchEmail(email);
      if (result.status === 'active') {
        // The address has an active account — they should sign in from
        // the main login form, not register a new branch.
        setStep('already_registered');
      } else if (result.status === 'no_password') {
        setStep('no_password');
      } else if (result.status === 'pending') {
        setStep('pending');
      } else if (result.status === 'rejected') {
        setStep('rejected');
      } else {
        setStep('register');
      }
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setStep('email');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : signInError.message,
      );
      setLoading(false);
    } else {
      window.location.href = '/associations';
    }
  }

  async function handleForgotPassword() {
    if (resetLoading || resetCooldown > 0) return;
    setResetLoading(true);
    setError(null);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/reset-password`,
    });
    setResetLoading(false);
    setResetSent(true);
    startResetCooldown();
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !district) {
      setError('Lütfen il ve ilçe seçiniz.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const rawPhone = phone.replace(/\s/g, '');
      await requestBranchRegistration({
        email,
        fullName,
        phone: rawPhone ? `+90${rawPhone}` : undefined,
        city,
        district,
        message: message || undefined,
      });
      setStep('pending');
    } catch {
      setError('Başvuru gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'email' || step === 'checking') {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="branch-email" className="text-[13px] font-medium">
            E-posta
          </Label>
          <Input
            id="branch-email"
            type="email"
            autoComplete="email"
            placeholder="sube@dernek.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              Kontrol ediliyor...
            </>
          ) : (
            <>
              Devam et
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    );
  }

  if (step === 'already_registered') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <MailQuestion className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">Bu adres zaten kayıtlı</h3>
          <p className="text-[13px] text-muted-foreground">
            <strong>{email}</strong> adresine ait aktif bir hesap var. Lütfen ana giriş ekranından
            şifrenizle giriş yapın.
          </p>
        </div>
        <div className="space-y-2">
          {onClose && (
            <Button type="button" size="lg" onClick={onClose} className="w-full">
              Ana giriş ekranına dön
            </Button>
          )}
          <button
            type="button"
            onClick={() => { setStep('email'); setError(null); }}
            className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground"
          >
            ← Farklı e-posta dene
          </button>
        </div>
      </div>
    );
  }

  if (step === 'no_password') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <MailQuestion className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">Şifreniz belirlenmemiş</h3>
          <p className="text-[13px] text-muted-foreground">
            Hesabınıza şifre oluşturulmamış. Lütfen Genel Başkan&apos;dan davet linkinin tekrar
            gönderilmesini isteyin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setStep('email'); setError(null); }}
          className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground"
        >
          ← Farklı e-posta kullan
        </button>
      </div>
    );
  }

  if (step === 'register') {
    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
          Bu e-posta sistemde kayıtlı değil. Başvuru formunu doldurun, Genel Başkan onayladıktan sonra e-posta adresinize giriş linki gönderilecektir.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="reg-fullname" className="text-[13px] font-medium">
            Başkan Ad Soyad <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-fullname"
            type="text"
            autoComplete="name"
            placeholder="Ali Veli"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[13px] font-medium">
            İl <span className="text-destructive">*</span>
          </Label>
          <Select value={city} onValueChange={handleCityChange} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="İl seçiniz..." />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[13px] font-medium">
            İlçe <span className="text-destructive">*</span>
          </Label>
          <Select value={district} onValueChange={setDistrict} disabled={loading || !city}>
            <SelectTrigger>
              <SelectValue placeholder={city ? 'İlçe seçiniz...' : 'Önce il seçiniz'} />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-phone" className="text-[13px] font-medium">
            İletişim <span className="text-muted-foreground">(opsiyonel)</span>
          </Label>
          <PhoneInput
            id="reg-phone"
            value={phone}
            onChange={setPhone}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-message" className="text-[13px] font-medium">
            Not <span className="text-muted-foreground">(opsiyonel)</span>
          </Label>
          <Textarea
            id="reg-message"
            placeholder="Başvurunuzla ilgili eklemek istedikleriniz..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            rows={3}
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

        <Button
          type="submit"
          size="lg"
          disabled={loading || !fullName.trim() || !city || !district}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gönderiliyor...
            </>
          ) : (
            'Başvuru Gönder'
          )}
        </Button>

        <button
          type="button"
          onClick={() => setStep('email')}
          className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground"
        >
          ← Geri dön
        </button>
      </form>
    );
  }

  if (step === 'pending') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Clock className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">Başvurunuz inceleniyor</h3>
          <p className="text-[13px] text-muted-foreground">
            Genel Başkan onayladıktan sonra davet linkiniz e-posta adresinize gönderilecektir.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'rejected') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">Başvurunuz onaylanmadı</h3>
          <p className="text-[13px] text-muted-foreground">
            Daha fazla bilgi için yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function BrandPanel() {
  return (
    <aside
      className="relative order-1 hidden overflow-hidden text-white lg:order-2 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12"
      style={{
        backgroundColor: '#0E0E0E',
        backgroundImage: [
          'linear-gradient(rgba(252,194,0,0.06), rgba(252,194,0,0))',
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
        ].join(', '),
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[380px] w-[380px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(252,194,0,0.18), rgba(252,194,0,0) 60%)',
        }}
      />

      <div className="relative z-10">
        <Brand dark />
      </div>

      <div className="relative z-10 max-w-md space-y-8">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
            <Sparkles className="h-3 w-3 text-primary" />
            Türkiye&apos;nin Dernekleri İçin
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Dernek sekreterliğini,
            <br />
            <span className="text-primary">tek yerden yönetin.</span>
          </h1>
          <p className="text-sm leading-relaxed text-white/65">
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
        </ul>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/50">
        <span>© {new Date().getFullYear()} Dernek Organizer</span>
        <span>TR</span>
      </div>
    </aside>
  );
}

function Brand({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/yedihilal-logo.png"
        alt="YediHilal"
        width={32}
        height={45}
        className="h-11 w-auto"
        priority
      />
      <div className="leading-tight">
        <div className={`text-[13px] font-bold tracking-tight ${dark ? 'text-white' : 'text-foreground'}`}>
          Dernek Organizer
        </div>
        <div className={`text-[10px] font-medium uppercase tracking-widest ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
          Sicil &amp; Üyelik
        </div>
      </div>
    </div>
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
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-semibold text-white">{title}</div>
        <div className="text-xs text-white/60">{body}</div>
      </div>
    </li>
  );
}
