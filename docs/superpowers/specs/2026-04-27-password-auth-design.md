# Şube Kullanıcıları için Şifre Tabanlı Kimlik Doğrulama

**Tarih:** 2026-04-27  
**Kapsam:** Şube kullanıcılarının magic link yerine şifre ile giriş yapması

---

## Sorun

Mevcut sistemde şube kullanıcıları her giriş denemesinde magic link talep etmek zorunda. Bu hem Supabase e-posta maliyetini artırıyor hem de kullanıcı deneyimini zorlaştırıyor.

---

## Hedef Akış

### İlk Kayıt (değişmedi)
1. Kullanıcı login sayfasında Şube sekmesinden e-posta giriyor.
2. `POST /auth/check-branch-email` → `unknown` döner.
3. Kayıt formu gösterilir, kullanıcı doldurup gönderiyor.
4. `PendingBranchRegistration` kaydı oluşur, durum `PENDING`.

### Onay (değişiyor)
1. Sistem Yöneticisi (Genel Başkan) admin panelinden başvuruyu onaylar.
2. API; 8 karakterlik güvenli geçici şifre üretir (`crypto.randomBytes`).
3. Supabase admin API ile kullanıcı `password` ve `email_confirm: true` ile oluşturulur.
4. Prisma transaction: `User` upsert + `AssociationMembership` oluşturma + `mustChangePassword: true`.
5. Kullanıcıya geçici şifresini içeren e-posta gönderilir (magic link değil).

### Sonraki Girişler (değişiyor)
1. Kullanıcı Şube sekmesinde e-postasını giriyor.
2. `check-branch-email` → `active` döner.
3. Şifre alanı gösterilir, `supabase.auth.signInWithPassword()` çağrılır.
4. Başarılı girişte `/associations` sayfasına yönlendirme.

### Onboarding
- İlk girişte `onboardingCompletedAt` null ise `/onboarding` sayfasına yönlendirme (mevcut davranış korunuyor).
- Onboarding tamamlandıktan sonra app shell'de `mustChangePassword: true` ise banner gösterilir.

### Şifre Değiştirme (yeni)
- App shell banner: "Geçici şifrenizle giriş yaptınız — güvenliğiniz için şifrenizi değiştirin."
- Banner üzerindeki "Şimdi Değiştir" butonu `/associations/[id]/settings` sayfasına yönlendirir.
- Şifre değiştirme: `supabase.auth.updateUser({ password: newPassword })`.
- Başarı sonrası: `POST /auth/clear-temp-password-flag` → `mustChangePassword: false`.
- Banner kaybolur.

---

## Veritabanı Değişiklikleri

### `User` modeli — yeni alan

```prisma
mustChangePassword  Boolean  @default(false)
```

Onay sırasında `true`, şifre değiştirilince `false` yapılır.

---

## API Değişiklikleri

### `POST /auth/pending-registrations/:id/approve` (güncelleniyor)

**Mevcut:** Supabase'de `email_confirm: true` ile şifresiz kullanıcı oluşturur, magic link gönderir.  
**Yeni:**
1. `crypto.randomBytes(6).toString('base64url')` ile 8 karakterlik geçici şifre üretilir.
2. `auth.createUser({ email, password: tempPassword, email_confirm: true })` çağrılır.
3. Transaction içinde `User` oluşturulurken `mustChangePassword: true` set edilir.
4. `email.sendTempPassword(email, fullName, tempPassword)` çağrılır.

### `POST /auth/pending-registrations/:id/resend` (güncelleniyor)

**Mevcut:** Magic link gönderir.  
**Yeni:**
1. Yeni geçici şifre üretilir.
2. `auth.adminAuth.updateUserById(supabaseUserId, { password: newTempPassword })` ile Supabase şifresi güncellenir.
3. `mustChangePassword: true` set edilir (idempotent).
4. Temp password e-postası tekrar gönderilir.

### `POST /auth/send-otp` (kaldırılıyor)

Şube kullanıcıları artık OTP kullanmadığından bu endpoint silinir.

### `GET /auth/me` (güncelleniyor)

Yanıta `mustChangePassword: boolean` alanı eklenir.

### `POST /auth/clear-temp-password-flag` (yeni)

- Guard: `AuthGuard, SupabaseUserGuard`
- `User.mustChangePassword = false` set eder.
- 200 OK döner.

---

## E-posta Şablonu

`EmailService`'e `sendTempPassword(to, fullName, tempPassword)` metodu eklenir.

İçerik:
- "Başvurunuz onaylandı" başlığı
- Geçici şifreyi açık metin olarak gösterir (monospace font)
- "İlk girişten sonra şifrenizi değiştirmeniz önerilir" notu
- Login sayfasına link

---

## Frontend Değişiklikleri

### `apps/web/src/app/(auth)/login/page.tsx`

**BranchLoginPanel:**
- `BranchStep` tipinden `'send-otp'` ve `'sent'` adımları kaldırılır.
- `active` durumunda: şifre input'u gösterilir, `supabase.auth.signInWithPassword()` çağrılır.
- "Şifremi unuttum" butonu eklenir → `supabase.auth.resetPasswordForEmail()`.
- Bekleyen başvurular için metin güncellenir: "giriş bağlantısı" yerine "geçici şifre".

### `apps/web/src/lib/api/auth.ts`

- `sendBranchOtp` fonksiyonu kaldırılır.
- `clearTempPasswordFlag()` fonksiyonu eklenir.

### `apps/web/src/app/(protected)/_components/app-shell.tsx`

- `mustChangePassword` değeri user context'ten okunur.
- `mustChangePassword: true` ise sarı uyarı banner'ı gösterilir.
- Banner içinde "Şimdi Değiştir" butonu → `/associations/[activeAssociationId]/settings#password`.

### `apps/web/src/app/(protected)/associations/[id]/settings/` (yeni sayfa)

- "Şifre Değiştir" bölümü: yeni şifre + onayla alanları.
- Minimum 8 karakter validasyonu (client-side Zod).
- Submit: `supabase.auth.updateUser({ password })` → `clearTempPasswordFlag()`.
- Başarı toast'ı gösterilir.

---

## Kapsam Dışı

- "Şifremi Unuttum" e-posta şablonunu özelleştirme (Supabase default şablonu kullanılır).
- Eski magic link callback route'larını silme (`/callback`, `/callback-magic`) — başka akışlar kullanıyor olabilir.
- Genel Başkan (admin) login akışı — zaten şifreli, değişmiyor.
