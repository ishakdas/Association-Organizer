# Brevo Email Entegrasyonu Planı

## Durum: ✅ Tamamlandı

## Tarih
2026-05-18

## Problem
- Resend ve SMTP altyapısı kullanılıyordu ancak bu servisler aktif değildi
- Telegram deep link email'leri için custom email gönderim mekanizması gerekiyordu
- Supabase'in email sistemi sadece auth akışları için çalışır (magic link, invite, password reset)
- Custom email'ler (Telegram link, temp password vb.) için harici bir provider gerekiyordu

## Çözüm
Brevo (eski Sendinblue) entegrasyonu yapıldı:
- **Ücretsiz tier**: 300 email/gün (~9.000/ay)
- **API key** ile çalışır, SMTP env gerekmez
- **Node.js SDK** mevcut (`@getbrevo/brevo`)
- **Dashboard**'dan template yönetimi ve sender doğrulama yapılabilir

## Yapılan Değişiklikler

### 1. Bağımlılıklar
| Paket | Aksiyon |
|-------|---------|
| `@getbrevo/brevo@^5.0.4` | Eklendi |
| `resend@^4.0.0` | Kaldırıldı |
| `nodemailer@^8.0.7` | Kaldırıldı |
| `@types/nodemailer@^8.0.0` | Kaldırıldı |

### 2. Environment Variables
| Değişken | Açıklama |
|----------|----------|
| `BREVO_API_KEY` | Brevo API key (https://app.brevo.com/settings/keys/api) |
| `BREVO_FROM_EMAIL` | Gönderen email (Brevo dashboard'da doğrulanmış olmalı) |
| `BREVO_FROM_NAME` | Gönderen adı (varsayılan: "Dernek Yönetim Sistemi") |

Kaldırılan değişkenler: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### 3. EmailService Refactoring
- `Resend` ve `nodemailer` import'ları kaldırıldı
- `@getbrevo/brevo` ile `TransactionalEmailsApi` kullanılıyor
- `sendViaResend()` → `send()` (tek method, Brevo üzerinden)
- `sendViaNodemailer()` kaldırıldı
- Tüm HTML template'ler korundu (React Email + inline HTML)
- Brevo yapılandırılmamışsa email gönderimi atlanır (warning log)

### 4. Email Akışları
| Email Tipi | Method | Template |
|------------|--------|----------|
| Magic link / davet | `sendMagicLink()` | React Email (`magic-link.tsx`) |
| Hoş geldiniz | `sendWelcome()` | React Email (`welcome.tsx`) |
| Telegram deep link | `sendTelegramLinkEmail()` | React Email (`telegram-link.tsx`) |
| Geçici şifre | `sendTempPassword()` | Inline HTML |
| Şube daveti | `sendBranchInvite()` | Inline HTML |
| Davet (fallback) | `sendInvitation()` | Inline HTML |

### 5. EmailLog
Tüm email gönderimleri `EmailLog` tablosuna kaydedilir:
- `templateKey`: Hangi template kullanıldı
- `status`: `SENT` veya `FAILED`
- `resendId`: Brevo messageId
- `error`: Hata mesajı (varsa)

## Supabase Email İlişkisi

| Akış | Email Gönderim | Provider |
|------|----------------|----------|
| Şube onayı (approveBranchRegistration) | Supabase magic link URL → Brevo ile gönder | Supabase + Brevo |
| Davet yeniden gönderme (resendInvite) | Supabase magic link URL → Brevo ile gönder | Supabase + Brevo |
| Kullanıcı daveti (resendInviteForUser) | Supabase magic link URL → Brevo ile gönder | Supabase + Brevo |
| Telegram link | Token + deep link URL → Brevo ile gönder | Brevo |

## Kurulum Adımları (Production)

1. **Brevo hesabı oluştur**: https://app.brevo.com
2. **Sender email doğrula**: Settings → Senders → Add Sender
3. **API key oluştur**: Settings → API Keys → Create API Key
4. **Environment variables ekle**:
   ```
   BREVO_API_KEY="xkeysib-your-api-key"
   BREVO_FROM_EMAIL="noreply@yourdomain.com"
   BREVO_FROM_NAME="Dernek Yönetim Sistemi"
   ```
5. **Test et**: Şube onayı veya Telegram link gönderimi ile test et

## Maliyet
- **Free tier**: 300 email/gün (~9.000/ay) — $0
- **Starter**: 20.000 email/ay — $25/ay
- **Business**: 50.000 email/ay — $65/ay

Tahmini proje ihtiyacı: ~200 email/ay (Telegram link + davet emailleri) → **Free tier yeterli**

## Dosyalar
| Dosya | Değişiklik |
|-------|------------|
| `apps/api/package.json` | Brevo eklendi, Resend/nodemailer kaldırıldı |
| `apps/api/.env.example` | Brevo env vars eklendi, SMTP/Resend kaldırıldı |
| `apps/api/src/config/env.validation.ts` | Brevo schema eklendi, SMTP/Resend kaldırıldı |
| `apps/api/src/config/configuration.ts` | Brevo config eklendi, smtp/resend kaldırıldı |
| `apps/api/src/modules/email/email.service.ts` | Tamamen Brevo'ya geçiş |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Test açıklaması güncellendi |
