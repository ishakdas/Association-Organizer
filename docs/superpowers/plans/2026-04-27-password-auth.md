# Password-Based Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Şube kullanıcıları magic link yerine geçici şifre ile hesaplarına erişir; sonraki girişlerde kendi belirledikleri şifreyi kullanır.

**Architecture:** Onay sırasında geçici şifre üretilip Supabase'e set edilir ve e-posta ile gönderilir. Login sayfasında `active` kullanıcılar için OTP akışı yerine email+şifre formu gösterilir. `mustChangePassword` flag'i DB'de tutulur; onboarding tamamlandıktan sonra app-shell'de banner gösterilir. Profil sayfasındaki mevcut şifre değiştirme formu, başarı sonrası flag'i temizler.

**Tech Stack:** NestJS, Prisma, Supabase Admin API, Next.js 15 App Router, TypeScript

---

## Dosya Haritası

| Dosya | İşlem |
|---|---|
| `libs/database/prisma/schema.prisma` | `User.mustChangePassword` alanı eklenir |
| `libs/database/prisma/migrations/…` | Migration dosyası oluşturulur |
| `libs/shared-types/src/domain/auth.ts` | `AuthenticatedUser.mustChangePassword` eklenir |
| `apps/api/src/common/guards/auth.guard.ts` | `mustChangePassword` authUser'a taşınır |
| `apps/api/src/modules/auth/auth.service.ts` | temp-password mantığı, magic link kaldırılır, flag endpoint |
| `apps/api/src/modules/auth/auth.controller.ts` | `send-otp` kaldırılır, `clear-temp-password-flag` eklenir |
| `apps/api/src/modules/email/email.service.ts` | `sendTempPassword` eklenir, magic link metodları kaldırılır |
| `apps/web/src/lib/api/auth.ts` | `sendBranchOtp` kaldırılır, `clearTempPasswordFlag` eklenir |
| `apps/web/src/app/(auth)/login/page.tsx` | BranchLoginPanel → password formu |
| `apps/web/src/app/(protected)/_components/app-shell.tsx` | `mustChangePassword` banner |
| `apps/web/src/app/(protected)/settings/profile/page.tsx` | Şifre değişince flag temizlenir |

---

## Task 1: DB Migration — `mustChangePassword` alanı

**Files:**
- Modify: `libs/database/prisma/schema.prisma`
- Create: `libs/database/prisma/migrations/…/migration.sql` (pnpm db:migrate üretir)

- [ ] **Step 1: Schema'ya alan ekle**

`libs/database/prisma/schema.prisma` içinde `User` modelini bul ve `onboardingCompletedAt` satırının altına ekle:

```prisma
mustChangePassword    Boolean   @default(false)
```

Sonuç (82–93 arası satırlar):
```prisma
model User {
  id                    String    @id @default(cuid())
  supabaseUserId        String?   @unique
  email                 String?   @unique
  fullName              String
  phone                 String?
  isActive              Boolean   @default(true)
  onboardingCompletedAt DateTime?
  mustChangePassword    Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?
  ...
```

- [ ] **Step 2: Migration çalıştır**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm db:migrate
```

Migration adı sorulunca: `add_must_change_password`

Beklenen çıktı: `✓ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add libs/database/prisma/schema.prisma libs/database/prisma/migrations/
git commit -m "feat(db): add mustChangePassword field to User model"
```

---

## Task 2: Shared Types — `AuthenticatedUser` güncelleme

**Files:**
- Modify: `libs/shared-types/src/domain/auth.ts`

- [ ] **Step 1: `mustChangePassword` alanını ekle**

`libs/shared-types/src/domain/auth.ts` içinde `AuthenticatedUser` interface'ini güncelle:

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  fullName: string;
  supabaseUserId: string | null;
  memberships: AuthMembership[];
  systemRole: UserRole | null;
  telegramAccount: AuthTelegramAccount | null;
  onboardingCompletedAt: string | null;
  mustChangePassword: boolean;
}
```

- [ ] **Step 2: Build kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm db:generate
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add libs/shared-types/src/domain/auth.ts
git commit -m "feat(types): add mustChangePassword to AuthenticatedUser"
```

---

## Task 3: AuthGuard — `mustChangePassword` taşı

**Files:**
- Modify: `apps/api/src/common/guards/auth.guard.ts`

- [ ] **Step 1: authUser build'ine ekle**

`auth.guard.ts` içinde `authUser` nesnesinin oluşturulduğu yeri bul (47–58. satırlar) ve `mustChangePassword` ekle:

```typescript
const authUser: AuthenticatedUser = {
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  supabaseUserId: user.supabaseUserId,
  memberships,
  systemRole: memberships.some((m) => m.role === UserRole.SYSTEM_ADMIN)
    ? UserRole.SYSTEM_ADMIN
    : null,
  telegramAccount,
  onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  mustChangePassword: user.mustChangePassword,
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/common/guards/auth.guard.ts
git commit -m "feat(auth): expose mustChangePassword in AuthenticatedUser"
```

---

## Task 4: Email Service — `sendTempPassword` ekle, magic link metodlarını kaldır

**Files:**
- Modify: `apps/api/src/modules/email/email.service.ts`

- [ ] **Step 1: `sendTempPassword` metodunu ekle ve magic link metodlarını kaldır**

`email.service.ts` dosyasını şu hale getir. `sendMagicLink`, `sendApprovalMagicLink` ve ilgili private metodları kaldır; yerine `sendTempPassword` ve yeni HTML template ekle:

```typescript
async sendTempPassword(to: string, fullName: string, tempPassword: string): Promise<void> {
  const info = await this.transporter.sendMail({
    from: this.from,
    to,
    subject: 'Başvurunuz Onaylandı — Geçici Şifreniz',
    html: this.tempPasswordHtml(fullName, tempPassword),
  });

  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    this.logger.log(`[DEV] E-posta önizlemesi: ${preview}`);
  }
}
```

Private template metodunu da ekle (mevcut `magicLinkHtml`, `approvalHtml`, `button` metodlarını **sil** ve `tempPasswordHtml` ekle):

```typescript
private tempPasswordHtml(fullName: string, tempPassword: string): string {
  return this.wrapLayout(`
    <h1>Başvurunuz Onaylandı!</h1>
    <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
    <p>
      Dernek yönetim sistemine üyelik başvurunuz onaylandı.
      Aşağıdaki geçici şifre ile giriş yapabilirsiniz.
    </p>
    <div style="margin:24px 0;padding:20px;background:#f3f4f6;border-radius:8px;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Geçici Şifreniz</p>
      <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#111827;font-family:monospace;">${this.escape(tempPassword)}</p>
    </div>
    <p style="font-size:14px;color:#374151;">
      Giriş yaptıktan sonra <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi öneririz.
    </p>
    <p class="note">
      Bu e-postayı beklemiyordaydınız lütfen sistem yöneticinizle iletişime geçin.
    </p>
  `);
}
```

- [ ] **Step 2: Tip kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
nx run api:build 2>&1 | head -30
```

Beklenen: derleme hatası yok (veya sadece uyarı).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/email/email.service.ts
git commit -m "feat(email): replace magic link templates with temp password email"
```

---

## Task 5: Auth Service — geçici şifre mantığı

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`

- [ ] **Step 1: `approveBranchRegistration` metodunu güncelle**

Metodun sonundaki "Send approval email with magic link" bloğunu (324–330. satırlar) şu kodla değiştir:

```typescript
// --- Send temp password email ---
const tempPassword = this.generateTempPassword();

// Güncelleme: Supabase user'ı şifre ile oluştur (mevcut createUser call'u değiştir)
// Bu satırları bul (266-274):
//   const { data: userData, error: createError } = await auth.createUser({
//     email: registration.email,
//     email_confirm: true,
//     user_metadata: { full_name: registration.fullName },
//   });
// Ve şu şekilde değiştir:
```

`approveBranchRegistration` içindeki `auth.createUser` çağrısını bul (satır ~266) ve şu şekilde güncelle:

```typescript
const { data: userData, error: createError } = await auth.createUser({
  email: registration.email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { full_name: registration.fullName },
});
```

Transaction içindeki `user` upsert'ini bul ve `mustChangePassword: true` ekle:

```typescript
const user = await tx.user.upsert({
  where: { email: registration.email },
  update: { supabaseUserId, fullName: registration.fullName, mustChangePassword: true },
  create: {
    supabaseUserId,
    email: registration.email,
    fullName: registration.fullName,
    phone: registration.phone ?? null,
    isActive: true,
    mustChangePassword: true,
  },
});
```

Metodun sonundaki magic link bloğunu kaldır ve temp password e-postası ile değiştir:

```typescript
// --- Send temp password email ---
await this.email.sendTempPassword(registration.email, registration.fullName, tempPassword);
```

- [ ] **Step 2: `resendInvite` metodunu güncelle**

Mevcut `resendInvite` metodunu tamamen şu kodla değiştir:

```typescript
async resendInvite(id: string): Promise<{ sent: boolean }> {
  const registration = await this.prisma.pendingBranchRegistration.findUnique({
    where: { id },
  });
  if (!registration) throw new NotFoundException('Başvuru bulunamadı');
  if (registration.status !== PendingBranchStatus.APPROVED) {
    throw new BadRequestException('Bu başvuru onaylanmamış');
  }

  const user = await this.prisma.user.findUnique({
    where: { email: registration.email },
    select: { supabaseUserId: true },
  });
  if (!user?.supabaseUserId) return { sent: false };

  const tempPassword = this.generateTempPassword();
  const auth = this.supabase.getAuthClient();

  const { error } = await auth.updateUserById(user.supabaseUserId, {
    password: tempPassword,
  });
  if (error) {
    this.logger.error(`Supabase şifre güncellenemedi (${registration.email}): ${error.message}`);
    return { sent: false };
  }

  await this.prisma.user.update({
    where: { email: registration.email },
    data: { mustChangePassword: true },
  });

  await this.email.sendTempPassword(registration.email, registration.fullName, tempPassword);
  return { sent: true };
}
```

- [ ] **Step 3: `clearTempPasswordFlag` ve `generateTempPassword` metodlarını ekle**

`sendMagicLink` ve `generateMagicActionLink` metodlarını **sil**. Yerine şunları ekle:

```typescript
async clearTempPasswordFlag(userId: string): Promise<void> {
  await this.prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });
}

private generateTempPassword(): string {
  return randomBytes(8).toString('base64url');
}
```

- [ ] **Step 4: Build kontrolü**

```bash
nx run api:build 2>&1 | tail -20
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts
git commit -m "feat(auth): replace magic link approval with temp password flow"
```

---

## Task 6: Auth Controller — endpoint güncelle

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: `send-otp` endpoint'ini kaldır**

`auth.controller.ts` içinden şu bloğu komple sil:

```typescript
@Post('send-otp')
@HttpCode(HttpStatus.OK)
sendOtp(@Body() body: { email: string }) {
  return this.authService.sendMagicLink(body.email);
}
```

- [ ] **Step 2: `clear-temp-password-flag` endpoint'ini ekle**

`completeOnboarding` endpoint'inin altına ekle:

```typescript
@Post('clear-temp-password-flag')
@UseGuards(AuthGuard, SupabaseUserGuard)
@HttpCode(HttpStatus.OK)
clearTempPasswordFlag(@CurrentUser() user: RequestUser) {
  return this.authService.clearTempPasswordFlag(user.id);
}
```

- [ ] **Step 3: Build kontrolü**

```bash
nx run api:build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat(auth): remove send-otp endpoint, add clear-temp-password-flag"
```

---

## Task 7: Frontend API Client — auth.ts güncelle

**Files:**
- Modify: `apps/web/src/lib/api/auth.ts`

- [ ] **Step 1: `sendBranchOtp` kaldır, `clearTempPasswordFlag` ekle**

`apps/web/src/lib/api/auth.ts` dosyasını şu hale getir:

```typescript
import { apiClient } from './client';

export interface BranchEmailStatus {
  status: 'unknown' | 'pending' | 'rejected' | 'active';
}

export interface PendingRegistration {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export function checkBranchEmail(email: string) {
  return apiClient<BranchEmailStatus>('/auth/check-branch-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function requestBranchRegistration(data: {
  email: string;
  fullName: string;
  phone?: string;
  message?: string;
}) {
  return apiClient<void>('/auth/request-branch-registration', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listPendingRegistrations(token: string) {
  return apiClient<PendingRegistration[]>('/auth/pending-registrations', { token });
}

export function listApprovedRegistrations(token: string) {
  return apiClient<PendingRegistration[]>('/auth/approved-registrations', { token });
}

export function resendInvite(token: string, id: string) {
  return apiClient<{ sent: boolean }>(`/auth/pending-registrations/${id}/resend`, {
    token,
    method: 'POST',
  });
}

export function approveBranchRegistration(
  token: string,
  id: string,
  data: { associationId: string; role: string },
) {
  return apiClient<void>(`/auth/pending-registrations/${id}/approve`, {
    token,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function rejectBranchRegistration(token: string, id: string) {
  return apiClient<void>(`/auth/pending-registrations/${id}/reject`, {
    token,
    method: 'POST',
  });
}

export function clearTempPasswordFlag(token: string) {
  return apiClient<void>('/auth/clear-temp-password-flag', {
    token,
    method: 'POST',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api/auth.ts
git commit -m "feat(web): remove sendBranchOtp, add clearTempPasswordFlag api"
```

---

## Task 8: Login Sayfası — BranchLoginPanel şifre akışı

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: BranchLoginPanel'i password tabanlı akışa çevir**

`login/page.tsx` içinde `BranchLoginPanel` ve `BranchStep` tipini tamamen şu kodla değiştir (import'lardan `sendBranchOtp`'yi kaldır, `MailCheck` ikonunu da kaldır):

```typescript
type BranchStep = 'email' | 'checking' | 'password' | 'register' | 'pending' | 'rejected';

function BranchLoginPanel() {
  const [step, setStep] = useState<BranchStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!email) {
      setError('Şifre sıfırlama için e-posta adresinizi girin.');
      return;
    }
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/settings/profile`,
    });
    setError(null);
    alert('Şifre sıfırlama bağlantısı e-postanıza gönderildi.');
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await requestBranchRegistration({
        email,
        fullName,
        phone: phone || undefined,
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
          Bu e-posta sistemde kayıtlı değil. Başvuru formunu doldurun, Genel Başkan onayladıktan sonra geçici şifreniz e-posta ile gönderilecektir.
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
          <Label htmlFor="reg-phone" className="text-[13px] font-medium">
            Telefon <span className="text-muted-foreground">(opsiyonel)</span>
          </Label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+90 555 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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

        <Button type="submit" size="lg" disabled={loading || !fullName.trim()} className="w-full">
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
```

Import satırlarından `MailCheck` ve `sendBranchOtp`'yi kaldır. `requestBranchRegistration` import'u kalır.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(auth)/login/page.tsx
git commit -m "feat(login): replace OTP flow with password login for branch users"
```

---

## Task 9: App Shell — `mustChangePassword` banner

**Files:**
- Modify: `apps/web/src/app/(protected)/_components/app-shell.tsx`

- [ ] **Step 1: Banner bileşeni ve mantığını ekle**

`app-shell.tsx` dosyasında:

1. Import'lara `AlertTriangle` ekle:
```typescript
import {
  AlertTriangle,
  BookOpen,
  // ... geri kalanlar aynı
} from 'lucide-react';
```

2. `AppShell` fonksiyonu içinde `<div className="flex min-h-screen bg-background">` satırından önce banner'ı ekle. `AppShell` bileşeninin return'ünü şu şekilde güncelle:

```typescript
return (
  <div className="flex min-h-screen bg-background">
    <Sidebar
      user={user}
      items={items}
      mobileOpen={mobileOpen}
      onClose={() => setMobileOpen(false)}
    />

    <div className="flex min-w-0 flex-1 flex-col">
      <MobileTopbar onMenu={() => setMobileOpen(true)} />
      {user.mustChangePassword && user.onboardingCompletedAt && (
        <TempPasswordBanner />
      )}
      <main className="flex-1 px-5 pb-24 pt-6 sm:px-8 sm:py-10 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
      <BottomNav items={primary} />
    </div>
  </div>
);
```

3. Dosyanın sonuna `TempPasswordBanner` bileşenini ekle:

```typescript
function TempPasswordBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-[13px] font-medium">
        Geçici şifrenizle giriş yaptınız. Güvenliğiniz için şifrenizi değiştirmenizi öneririz.
      </p>
      <a
        href="/settings/profile"
        className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
      >
        Şimdi Değiştir
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(protected)/_components/app-shell.tsx
git commit -m "feat(shell): show temp password banner when mustChangePassword is true"
```

---

## Task 10: Profil Sayfası — flag temizleme

**Files:**
- Modify: `apps/web/src/app/(protected)/settings/profile/page.tsx`

- [ ] **Step 1: `clearTempPasswordFlag` import ve çağrısı ekle**

`settings/profile/page.tsx` dosyasında:

1. Import'a `clearTempPasswordFlag` ekle:
```typescript
import { clearTempPasswordFlag } from '@/lib/api/auth';
```

2. `handleChangePassword` fonksiyonunu bul. `toast.success('Parola güncellendi');` satırından sonra flag'i temizle ve sayfayı refresh et:

```typescript
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

    // Geçici şifre flag'ini temizle
    try {
      const token = await getToken();
      await clearTempPasswordFlag(token);
    } catch {
      // Non-blocking
    }

    setNewPwd('');
    setConfirmPwd('');
    toast.success('Parola güncellendi');

    // Sunucu tarafını yenile (banner'ın kaybolması için)
    window.location.reload();
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    setSavingPwd(false);
  }
}
```

- [ ] **Step 2: Build kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
nx run web:build 2>&1 | tail -20
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(protected)/settings/profile/page.tsx
git commit -m "feat(profile): clear mustChangePassword flag after password change"
```

---

## Task 11: API Test — approval flow kontrolü

**Files:**
- Test: `apps/api/src/modules/associations/associations.service.spec.ts` (mevcut test referansı)

- [ ] **Step 1: API'yi başlat ve akışı manuel test et**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm dev:api
```

- [ ] **Step 2: `checkBranchEmail` → `active` response kontrolü**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/check-branch-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | jq .
```

Beklenen: `{"status":"unknown"}` (kayıtlı değilse)

- [ ] **Step 3: `/auth/me` response'unda `mustChangePassword` var mı?**

Geçerli bir token ile:
```bash
curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>" | jq .mustChangePassword
```

Beklenen: `false` veya `true`

- [ ] **Step 4: `send-otp` endpoint'inin kalkmış olduğunu doğrula**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Beklenen: 404 Not Found

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "test(auth): verify password flow endpoints" --allow-empty
```

---

## Task 12: Web Test — login + banner + profil akışı

- [ ] **Step 1: Web uygulamasını başlat**

```bash
pnpm dev:web
```

- [ ] **Step 2: Şube tab'ı — kayıtlı kullanıcı senaryosu**

1. `http://localhost:3001/login` aç
2. Şube sekmesine tıkla
3. Aktif bir kullanıcı e-postası gir → "Devam et"
4. Şifre formu göründüğünü doğrula (OTP "bağlantı gönderildi" ekranı değil)
5. Yanlış şifre gir → hata mesajı görünmeli
6. Doğru şifre ile giriş yap → `/associations` veya `/onboarding`'e yönlenmeli

- [ ] **Step 3: `mustChangePassword: true` olan kullanıcı**

1. DB'de `mustChangePassword: true` olan bir kullanıcıyla giriş yap
2. Onboarding varsa tamamla
3. App shell'de sarı banner göründüğünü doğrula
4. "Şimdi Değiştir" → `/settings/profile` sayfasına gidiyor mu?
5. Yeni şifre gir, kaydet → banner kaybolmuş mu? (sayfa yenilenir)

- [ ] **Step 4: Kayıt formu metin güncelleme kontrolü**

"Genel Başkan onayladıktan sonra geçici şifreniz e-posta adresinize gönderilecektir" metnini gör.
