# Ortam Yönetimi

## Sınırlar

Local geliştirme, local Supabase Auth ve PostgreSQL kullanır. Production API Railway'de, web Netlify'da, Auth ve PostgreSQL hosted Supabase projesinde çalışır. Prisma migration dosyaları her iki ortam için tek şema kaynağıdır.

## İlk Local Kurulum

Node 20, pnpm 10, Docker ve Supabase CLI kurulu olmalıdır.

```bash
pnpm install
pnpm local:setup
pnpm dev
```

`local:setup`, Supabase stack'i başlatır, `.env.local` dosyasını local servis bilgilerinden üretir, Prisma migration'larını uygular, referans verisini yükler ve local sistem yöneticisini oluşturur.

Eski kök `.env` dosyası local kurulum doğrulandıktan sonra güvenli bir parola yöneticisine taşınmalı ve çalışma dizininden kaldırılmalıdır. Local komutlar `.env.local` değerlerini öncelikli kullanır.

Local giriş bilgileri `.env.local` içindeki `LOCAL_ADMIN_EMAIL` ve `LOCAL_ADMIN_PASSWORD` değerleridir. Local e-postalar dışarı gönderilmez; uygulama ve Supabase Auth e-postaları `http://127.0.0.1:54324` adresindeki Mailpit arayüzünde görülebilir.

## Günlük Akış

```bash
pnpm dev
pnpm db:migrate
pnpm test
```

`pnpm dev`; local Supabase'i başlatır, `.env.local` dosyasını yeniler, bekleyen migration'ları uygular, local admin hesabını hazırlar ve API, web, Mailpit ile local Telegram botunu birlikte çalıştırır. Telegram bilgileri Git tarafından yok sayılan `.env.telegram.local` dosyasında bulunmuyorsa bot kapalı başlar.

Local altyapıyı durdurmak için:

```bash
pnpm local:stop
```

Telegram geliştirmesi production botundan ayrı bir test botu ile yapılır. Test botunun bilgileri Git tarafından yok sayılan `.env.telegram.local` dosyasında tutulur ve `pnpm dev` tarafından otomatik yüklenir.

Local uygulama şemasını ve verisini sıfırlamak için:

```bash
pnpm local:reset
pnpm local:auth-seed
```

## Production Değişkenleri

Railway aşağıdaki değişkenleri dashboard üzerinden almalıdır:

```text
DATABASE_URL
DIRECT_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
JWT_SECRET
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
API_URL
WEB_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
```

Container production çalışma modu, Telegram, pg-boss, gecikmiş görev kontrolü ve Resend teslimatını varsayılan olarak açar.

Netlify production context aşağıdaki değerleri dashboard üzerinden almalıdır:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
```

Deploy Preview context'e production Supabase veya API değerleri verilmemelidir. Ayrı preview altyapısı yoksa Deploy Preview kapalı tutulmalıdır.

## Yayın Akışı

1. `feature/*` branch üzerinde local geliştirme yapılır.
2. Prisma migration ve kod aynı PR'a eklenir.
3. CI lint, build, unit test ve secret kontrolünü geçirir.
4. PR `main` branch'e merge edilir.
5. Railway yalnızca `main` branch'i deploy eder ve CI sonucunu bekler.
6. Netlify production branch olarak yalnızca `main` kullanır.
7. API health endpoint'i ve kritik kullanıcı akışları kontrol edilir.
8. Başarılı sürüm `vX.Y.Z` etiketiyle işaretlenir.

Kırıcı şema değişiklikleri iki sürüme bölünür. İlk sürüm yeni alanı ekleyip eski alanla birlikte çalışır. İkinci sürüm veri geçişinden sonra eski alanı kaldırır.

## Dashboard Kontrol Listesi

- Supabase service-role anahtarı yenilenir ve eski anahtar iptal edilir.
- Railway production değişkenleri güncellenir.
- Railway deployment branch'i `main` olarak ayarlanır.
- Railway Wait for CI etkinleştirilir.
- Netlify production branch'i `main` olarak ayarlanır.
- Netlify Deploy Preview production değişkenlerini miras almaz.
- GitHub `main` branch için PR ve başarılı CI zorunlu tutulur.
- Force push ve branch silme kapatılır.
