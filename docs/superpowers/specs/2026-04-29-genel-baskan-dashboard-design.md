# Genel Başkan Ekranı — Dashboard & Şube Kartları Tasarım Dokümanı

**Tarih:** 2026-04-29  
**Kapsam:** SYSTEM_ADMIN ekranlarının yeniden tasarımı

---

## Özet

Genel Başkan (SYSTEM_ADMIN) akışında üç ana değişiklik yapılacak:

1. Manuel şube ekleme akışı kaldırılır — şubeler artık yalnızca bekleyen başvuruların onaylanmasıyla oluşturulur.
2. `/dashboard` adında yeni bir ana sayfa eklenir: istatistik kartları ve şehir dağılımı.
3. `/associations` sayfası tamamen kart tabanlı bir grid görünümüne kavuşturulur; kartlara tıklandığında canlı DB verisiyle dolu bir modal açılır.

---

## 1. API Katmanı

### 1.1 Yeni endpoint: `GET /api/v1/associations/stats`

- Guard: `AuthGuard → SupabaseUserGuard → RolesGuard` + `@Roles(SYSTEM_ADMIN)`
- Response shape:

```ts
{
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
  totalMembers: number;          // tüm aktif AssociationMembership sayısı
  pendingRegistrations: number;  // PendingBranchRegistration.status = PENDING
  cityDistribution: { city: string; count: number }[]; // en fazla 10 şehir, sayıya göre desc
}
```

- Prisma sorguları:
  - `association.count()` → toplam / aktif / pasif
  - `associationMembership.count()` → toplam üye
  - `pendingBranchRegistration.count({ where: { status: 'PENDING' } })`
  - `association.groupBy({ by: ['city'], _count: true, orderBy: ..., take: 10 })`

### 1.2 Mevcut endpoint'ler

- `GET /api/v1/associations` — şube listesi, değiştirilmez
- `GET /api/v1/associations/:id` — şube detayı, modal için yeterli (name, city, district, email, phone, memberCount, isActive)
- `GET /api/v1/associations/:id/members?role=ASSOCIATION_MANAGER` — başkan bilgisi için kullanılır
- `POST /api/v1/associations` — **backend'de korunur**, sadece frontend'den erişim kaldırılır

---

## 2. Navigasyon

`apps/web/src/app/(protected)/_components/app-shell.tsx` — `buildNav` fonksiyonu güncellenir.

### SYSTEM_ADMIN nav (yeni):

| Label | Href | Icon |
|---|---|---|
| Ana Sayfa | `/dashboard` | `Home` |
| Şubeler | `/associations` | `BookUser` |
| Başvurular | `/admin/pending-registrations` | `UserCheck` (badge korunur) |
| Ayarlar | `/settings` | `Settings` |

### isNavActive güncelleme:

- `/dashboard` → exact match
- `/associations` → `pathname === '/associations'` (sadece liste sayfası; `/associations/:id` detay sayfaları korunur, `/associations/new` silinir)
- `/associations/:id` → `pathname.startsWith('/associations/')` hâlâ admin için geçerli

---

## 3. Dashboard Sayfası (`/dashboard`)

**Dosya:** `apps/web/src/app/(protected)/dashboard/page.tsx`

- Server Component
- `SYSTEM_ADMIN` değilse `/associations` redirect
- `GET /api/v1/associations/stats` server-side fetch
- İstemci hook'u yok — tam SSR

### Layout:

```
Başlık: "Genel Bakış"
Alt metin: Güncel istatistikler

[Stat Kartları — 3 kolon grid, 2 kolon md, 1 kolon sm]
  Toplam Şube | Aktif Şube | Pasif Şube
  Toplam Üye  | Bekleyen Başvuru

[Şehir Dağılımı — yatay bar chart]
  CSS-only, dış kütüphane yok
  Her şehir için: label + bar (max-width oranlaması) + sayı
```

### Stat kartı davranışı:

- "Bekleyen Başvuru" kartı: `pendingRegistrations > 0` ise amber arka plan + amber border
- Sayılar `tabular-nums` font feature ile gösterilir
- Her kart bir ikon içerir (Building2, CheckCircle, XCircle, Users, Clock)

---

## 4. Şubeler Sayfası (`/associations`)

### Kaldırılanlar:

- `canCreate` prop ve "Yeni Dernek" butonu
- VKN arama placeholder'ı → "Ad ile ara…" kalır
- Şehir filter input'u
- Masaüstü tablo görünümü (`AssociationTable`) — hem desktop hem mobile kart grid olur
- "Dernek Sicili" ve "Kayıtlı Dernekler" başlıkları → **"Şubeler"** olur
- `association-table.tsx` dosyası silinir
- `associations/new/page.tsx` dosyası silinir

### Kart grid:

- Her ekran boyutunda kart
- Mobile: 1 kolon
- `md+`: 2 kolon grid

### Kart tasarımı (hover — C şıkkı):

```
Normal:
  bg-card, border-border, rounded-xl, p-5, cursor-pointer

Hover:
  scale(1.02)
  background: gradient (primary/5 → primary/10)
  border-primary/40
  shadow-lg
  transition: all 200ms ease

İçerik:
  - Şube adı (font-semibold, text-[15px])
  - Şehir / İlçe (MapPin icon)
  - Üye sayısı (Users icon, tabular-nums)
  - Aktif/Pasif badge (sağ üst)
  - Ok işareti (→) hover'da sağa kayar (translate-x animasyonu)
```

**Tıklama:** `<Link>` değil, `onClick` → modal açılır. Kart üzerinde loading spinner gösterilir (modal fetch sırasında).

---

## 5. Şube Detay Modalı

### Veri fetching:

Modal açılınca iki paralel istek:
1. `GET /api/v1/associations/:id` → şube bilgisi (zaten AssociationDto'da mevcut)
2. `GET /api/v1/associations/:id/members?role=ASSOCIATION_MANAGER` → başkan bilgisi

### Modal içeriği:

```
Header:
  - Aktif/Pasif badge
  - Şube adı (büyük)
  - Şehir / İlçe
  - [✕ kapat]

İstatistik mini-grid (2 kolon):
  - Aktif Üye sayısı
  - Durum (Aktif / Pasif)

İletişim bölümü:
  - E-posta (Mail icon)
  - Telefon (Phone icon, varsa)

Başkan bölümü:
  - Ad Soyad (User icon)
  - E-posta (Mail icon)
  - Telefon (Phone icon, varsa)

Footer:
  - "Şubeye Git →" butonu → /associations/:id
```

**Loading state:** Karta tıklanınca kart üzerinde küçük spinner. Modal, her iki istek tamamlanınca açılır.  
**Hata state:** Toast ile bildirim, modal açılmaz.

---

## 6. Kaldırılan Dosyalar

| Dosya | Sebep |
|---|---|
| `apps/web/src/app/(protected)/associations/new/page.tsx` | Manuel şube ekleme akışı kaldırılıyor |
| `apps/web/src/app/(protected)/associations/_components/association-form.tsx` | Yukarıdaki ile bağlantılı |
| `apps/web/src/app/(protected)/associations/_components/association-table.tsx` | Tablo görünümü kaldırılıyor |
| `apps/web/src/app/(protected)/associations/_hooks/use-create-association.ts` | Manuel oluşturma hook'u |

---

## 7. Etkilenmeyen Alanlar

- Şube başkanlarının kendi şubelerine erişimi (`/associations/:id`) — değişmez
- Pending registrations akışı — değişmez
- Backend `POST /api/v1/associations` endpoint'i — silinmez
- `AssociationCard` component — mevcut dosya (`association-card.tsx`) yeni kart tasarımıyla yerini alır (VKN satırı ve Link wrapper kaldırılır, onClick + hover animasyonu eklenir)
- Tüm üye/görev/toplantı modülleri — değişmez
