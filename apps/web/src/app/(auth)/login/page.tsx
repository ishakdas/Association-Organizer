'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Loader2, Sparkles, Users, XCircle } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { checkBranchEmail, requestBranchRegistration } from '../../../lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getProvinceNames, getDistricts } from '@/lib/turkey-locations';

type ActiveTab = 'admin' | 'branch';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('admin');

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
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
            </div>

            <div className="flex rounded-lg border border-border bg-muted p-1">
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Genel Başkan
              </button>
              <button
                onClick={() => setActiveTab('branch')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'branch'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Şube
              </button>
            </div>

            {activeTab === 'admin' ? <AdminLoginPanel /> : <BranchLoginPanel />}
          </div>
        </div>

        <footer className="text-center text-[11px] uppercase tracking-widest text-muted-foreground lg:hidden">
          © {new Date().getFullYear()} Dernek Organizer
        </footer>
      </div>
    </div>
  );
}

function AdminLoginPanel() {
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

  async function handleResetPassword() {
    if (!email) {
      setError('Şifre sıfırlama için e-posta adresinizi girin.');
      return;
    }
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/settings`,
    });
    setError(null);
    alert('Şifre sıfırlama bağlantısı e-postanıza gönderildi.');
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
            onClick={handleResetPassword}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Şifremi unuttum
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

type BranchStep = 'email' | 'checking' | 'password' | 'register' | 'pending' | 'rejected';

function BranchLoginPanel() {
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

  const provinces = getProvinceNames();
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
        setStep('password');
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

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
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/settings/profile`,
    });
    setError(null);
    alert('Şifre sıfırlama bağlantısı e-postanıza gönderildi.');
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

  if (step === 'password') {
    return (
      <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="branch-email-ro" className="text-[13px] font-medium">
            E-posta
          </Label>
          <Input
            id="branch-email-ro"
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="branch-password" className="text-[13px] font-medium">
              Şifre
            </Label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Şifremi unuttum
            </button>
          </div>
          <Input
            id="branch-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <button
          type="button"
          onClick={() => { setStep('email'); setPassword(''); setError(null); }}
          className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground"
        >
          ← Farklı e-posta kullan
        </button>
      </form>
    );
  }

  if (step === 'register') {
    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
          Bu e-posta sistemde kayıtlı değil. Başvuru formunu doldurun, Genel Başkan onayladıktan sonra geçici şifreniz e-posta adresinize gönderilecektir.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="reg-fullname" className="text-[13px] font-medium">
            Ad Soyad <span className="text-destructive">*</span>
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
            Telefon <span className="text-muted-foreground">(opsiyonel)</span>
          </Label>
          <div className="flex items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="shrink-0 border-r border-input bg-muted/60 px-3 py-2 text-sm text-muted-foreground rounded-l-md select-none">
              +90
            </span>
            <input
              id="reg-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5XX XXX XX XX"
              value={phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                const formatted = digits
                  .replace(/^(\d{3})(\d{0,3})/, '$1 $2')
                  .replace(/^(\d{3} \d{3})(\d{0,2})/, '$1 $2')
                  .replace(/^(\d{3} \d{3} \d{2})(\d{0,2})/, '$1 $2')
                  .trim();
                setPhone(formatted);
              }}
              disabled={loading}
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
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
            Genel Başkan onayladıktan sonra geçici şifreniz e-posta adresinize gönderilecektir.
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
    <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
      <div aria-hidden className="bg-grid-slate absolute inset-0 opacity-60" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/20"
      />

      <div className="relative z-10">
        <Brand dark />
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
        </ul>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[11px] uppercase tracking-widest text-background/50">
        <span>© {new Date().getFullYear()} Dernek Organizer</span>
        <span>TR</span>
      </div>
    </aside>
  );
}

function Brand({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-md ${
          dark ? 'bg-background text-foreground' : 'bg-foreground text-background'
        }`}
      >
        <span className="text-[13px] font-extrabold tracking-tight">DO</span>
      </div>
      <div className="leading-tight">
        <div className={`text-[13px] font-bold tracking-tight ${dark ? 'text-background' : 'text-foreground'}`}>
          Dernek Organizer
        </div>
        <div className={`text-[10px] font-medium uppercase tracking-widest ${dark ? 'text-background/60' : 'text-muted-foreground'}`}>
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
