# AI Görev Atama Prompt İyileştirmesi — Tasarım Dokümanı

**Tarih:** 2026-05-03  
**Kapsam:** Toplantı notlarından otomatik görev çıkarma ve üye atamasının iyileştirilmesi

---

## Problem

Mevcut `EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT` çok genel: rollerin/unvanların sorumluluk alanlarını bilmiyor, üye bağlamında sistem rolü ve `customTitle` eksik, aynı kişiye konu alanıyla uyumlu birden fazla görev atama konusunda yönlendirme yok. Sonuç: AI toplantı notlarını kaba eşleştirmeyle analiz ediyor, görevler yanlış kişilere ya da hiç kimseye atanabiliyor.

---

## Karar

**Yaklaşım A — Tam Dinamik** seçildi:

- `MemberTitleDefinition` modeline `description String?` alanı eklenir.
- Seed'deki her unvana Türkçe, anahtar kelime açısından zengin sorumluluk açıklaması yazılır.
- `meetings.service.ts`'de üye bağlamı `role`, `customTitle`, `title.description` içerecek şekilde zenginleştirilir.
- System prompt tamamen yeniden yazılır.

---

## Veri Modeli

### Prisma Şema Değişikliği

```prisma
model MemberTitleDefinition {
  // ... mevcut alanlar ...
  description  String?   // Unvanın sorumluluk alanı — AI prompt'una beslenir
}
```

### Seed Açıklamaları

| Unvan | Açıklama |
|---|---|
| Teşkilat Başkanı | Üye kazanımı, üye kaydı, üye takibi, teşkilatlanma, koordinasyon, üye listeleri, iletişim ağı, ziyaret organizasyonu, üye bilgilendirme, katılım artırma, gönüllü yönetimi |
| Lise Başkanı | Lise öğrencileri, okul ziyaretleri, lise etkinlikleri, genç üye kazanımı, okul koordinatörleri, lise tanıtımı, öğrenci bilgilendirme, lise temsilcisi |
| Orta Okul Başkanı | Ortaokul öğrencileri, ortaokul ziyaretleri, ortaokul etkinlikleri, öğrenci ailesi iletişimi, ortaokul koordinasyonu, tanıtım faaliyetleri |
| Kadın Kolları Başkanı | Kadın üyeler, kadın etkinlikleri, hanım toplantıları, kadın dayanışması, kadın kolları organizasyonu, hanımlara yönelik faaliyetler |
| Kültür-Sanat Sorumlusu | Kültürel etkinlik, sanat organizasyonu, konser, sergi, tiyatro, şiir gecesi, panel, konferans, kültür programı, sanatsal faaliyet |
| Gençlik Kolu Sorumlusu | Gençlik faaliyetleri, genç üyeler, spor etkinlikleri, gezi, kampanya, gençlik buluşması, yaz programı, genç koordinasyon |
| Medya Sorumlusu | Sosyal medya, paylaşım, Instagram, Facebook, Twitter, basın açıklaması, haber, fotoğraf, video, dijital içerik, duyuru, tanıtım, web sitesi |
| Mali İşler Sorumlusu | Aidat, bütçe, gelir-gider, fatura, muhasebe, mali rapor, ödeme, tahsilat, harcama, finansal planlama, kasa |

`description` alanı mevcut title CRUD API'ı (`PATCH /titles/:id`) üzerinden güncellenebilir — yeni endpoint gerekmez.

---

## Üye Bağlamı Formatı

`meetings.service.ts`'deki Prisma sorgusu `role` ve `customTitle` alanlarını da çeker. Her üye şu formatta beslenir:

```
- User ID: <id>
  İsim: <fullName>
  Sistem Rolü: MANAGER (Başkan) | SECRETARY (Sekreter) | MEMBER (Üye)
  Unvan: <title.name> — <title.description>   ← description yoksa sadece unvan adı
  Özel Unvan: <customTitle>                    ← yalnızca varsa gösterilir
```

---

## Yeni System Prompt

```
Sen Türk dernek toplantı notlarından görev çıkaran bir yapay zekasın.

## Üye Bağlamı Nasıl Kullanılır

Her üyenin iki sorumluluk katmanı vardır:

1. SİSTEM ROLÜ — hiyerarşiyi ve genel yetkiyi belirler:
   - MANAGER (Başkan): Derneğin genel yönetimi, karar alma, resmi yazışmalar,
     imza yetkisi, stratejik planlama, dış temsil, yönetim kurulu kararları.
   - SECRETARY (Sekreter): Toplantı tutanakları, evrak takibi, yazışma,
     belge arşivi, idari organizasyon, gündem hazırlama.
   - MEMBER (Üye): Unvanına ve açıklamasına göre değerlendir.

2. UNVAN + AÇIKLAMA — konu alanını belirler (anahtar kelimeler içerir).
   Görevin konusu bu anahtar kelimelerle örtüşüyorsa o üyeye ata.

## Atama Kuralları

- Önce unvan/açıklama eşleşmesine bak. Birden fazla aday varsa en ilgili olanı seç.
- Unvan eşleşmesi yoksa sistem rolüne göre karar ver.
- Derneğin genel işleri, kararlar, dış temsil → MANAGER'a.
- İdari, evrak, yazışma → SECRETARY'ye.
- Notta isim geçiyorsa doğrudan o kişiye ata — isim önceliklidir.
- Görevler mümkün olduğunca farklı üyelere dağıtılmaya çalışılmalı, ancak
  konu alanı eşleşmesi her zaman önceliklidir. Bir unvana ait birden fazla
  görev çıktıysa ve o alanda yeterli üye yoksa, aynı kişiye birden fazla
  görev atanabilir — yanlış kişiye atamak yerine doğru kişiye yığmak tercih edilir.
- Hiçbir üye için yapay görev üretme — notlarda karşılığı olmayan görev atama.
- Eşleşen kimse yoksa assignedToUserId null bırak.

## Çıktı Kuralları

- title: ≤80 karakter, notların dilinde.
- description: notlardan 1-2 cümle bağlam; başlıktan açıksa null.
- Yalnızca somut, eyleme geçilebilir görevler — genel tartışmaları atlat.
- SADECE geçerli JSON döndür:
{"actionItems": [{"title": "...", "description": "..." | null, "assignedToUserId": "..." | null}]}
```

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `libs/database/prisma/schema.prisma` | `MemberTitleDefinition`'a `description String?` eklenir |
| `libs/database/prisma/seed.ts` | Her unvana genişletilmiş Türkçe açıklama yazılır |
| `libs/database/prisma/migrations/...` | `add_description_to_member_title_definition` migration |
| `apps/api/src/modules/meetings/meetings.service.ts` | Sorguya `role`, `customTitle` eklenir; üye bağlamı formatı zenginleştirilir |
| `libs/ai/src/prompts/extract-action-items.prompt.ts` | System prompt tamamen yeniden yazılır |
| `libs/shared-validation/src/schemas/title.schema.ts` | `description` alanı create/update şemalarına eklenir |
| `libs/shared-types/src/domain/` | Title DTO'larına `description` eklenir |

---

## Uçtan Uca Akış

```
analyzeContent çağrısı
  ↓
Prisma: üyeler çekilir
  → role, customTitle, title.name, title.description dahil
  ↓
buildExtractionUserPrompt: zengin üye bağlamı oluşturulur
  ↓
AI: yeni system prompt ile analiz
  → unvan açıklaması anahtar kelimelerle eşleştirir
  → sistem rolü hiyerarşisine göre karar verir
  → isim geçiyorsa doğrudan atar
  → konu alanı doğruysa birden fazla görev aynı kişiye atanabilir
  ↓
Dönen actionItems → frontend'e
```

---

## Kapsam Dışı

- Title description için ayrı web UI sayfası — mevcut `PATCH /titles/:id` yeterli.
- Yapay görev üretme mekanizması — notlarda karşılığı olmayan görev atanmaz.
- Yeni AI provider veya model değişikliği.
