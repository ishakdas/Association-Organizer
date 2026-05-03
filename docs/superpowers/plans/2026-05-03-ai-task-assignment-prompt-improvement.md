# AI Görev Atama Prompt İyileştirmesi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `MemberTitleDefinition`'a `description` alanı ekle, seed'e unvan açıklamaları yaz, üye bağlamını zenginleştir (sistem rolü + customTitle + title.description) ve AI system promptunu köklü biçimde yeniden yaz; böylece toplantı notlarındaki görevler doğru kişilere atanır.

**Architecture:** Prisma şemasına tek nullable kolon eklenir, migration çalıştırılır. Shared-validation ve titles service `description`'ı alır/döner. `meetings.service.ts` üye sorgusunu genişletir ve bağlam stringini yeniden formatlar. `extract-action-items.prompt.ts` tamamen yeniden yazılır.

**Tech Stack:** NestJS, Prisma, Zod, TypeScript, Groq (OpenAI-compat API via `llama-3.3-70b-versatile`)

---

## Dosya Haritası

| Dosya | İşlem |
|---|---|
| `libs/database/prisma/schema.prisma` | `MemberTitleDefinition`'a `description String?` eklenir |
| `libs/database/prisma/seed.ts` | Her unvana Türkçe açıklama yazılır |
| `libs/shared-validation/src/schemas/title.schema.ts` | `description` create/update/response şemalarına eklenir |
| `apps/api/src/modules/titles/titles.service.ts` | list/create/update `description` alanını işler |
| `apps/api/src/modules/titles/titles.service.spec.ts` | `description` içeren test senaryoları eklenir |
| `apps/api/src/modules/meetings/meetings.service.ts` | Sorgu ve bağlam formatı zenginleştirilir |
| `apps/api/src/modules/meetings/meetings.service.spec.ts` | `analyzeContent` zengin bağlam testi eklenir |
| `libs/ai/src/prompts/extract-action-items.prompt.ts` | System prompt tamamen yeniden yazılır |

---

## Task 1: Prisma Şemasına `description` Alanı Ekle ve Migration Çalıştır

**Files:**
- Modify: `libs/database/prisma/schema.prisma`

- [ ] **Step 1: Şemaya alanı ekle**

`MemberTitleDefinition` modeline `description` satırını ekle (tam konum aşağıda):

```prisma
model MemberTitleDefinition {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  description String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships AssociationMembership[]

  @@map("member_title_definitions")
}
```

- [ ] **Step 2: Migration oluştur ve uygula**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm db:migrate
```

Migration adı sorulduğunda: `add_description_to_member_title_definition`

Beklenen çıktı: `Your database is now in sync with your schema.`

- [ ] **Step 3: Prisma istemcisini yeniden üret**

```bash
pnpm db:generate
```

Beklenen çıktı: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add libs/database/prisma/schema.prisma libs/database/prisma/migrations
git commit -m "feat(db): add description field to MemberTitleDefinition"
```

---

## Task 2: Shared-Validation Title Şemalarını Güncelle

**Files:**
- Modify: `libs/shared-validation/src/schemas/title.schema.ts`

- [ ] **Step 1: Failing test yaz**

`libs/shared-validation/src/schemas/title.schema.ts` dosyasını test eden bir dosya yoksa direkt şemayı güncelle; ancak önce mevcut şemanın `description`'ı reject ettiğini doğrula:

```bash
node -e "
const { createMemberTitleSchema } = require('./libs/shared-validation/src/schemas/title.schema');
const r = createMemberTitleSchema.safeParse({ name: 'Test', description: 'açıklama' });
console.log('description accepted:', r.success && 'description' in (r.data ?? {}));
"
```

Beklenen: `description accepted: false` (şu an şema `description` tanımıyor)

- [ ] **Step 2: Şemayı güncelle**

`libs/shared-validation/src/schemas/title.schema.ts` dosyasının tamamını şu içerikle değiştir:

```typescript
import { z } from 'zod';

export const titleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type TitleResponse = z.infer<typeof titleResponseSchema>;

export const createMemberTitleSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type CreateMemberTitleInput = z.infer<typeof createMemberTitleSchema>;

export const updateMemberTitleSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });
export type UpdateMemberTitleInput = z.infer<typeof updateMemberTitleSchema>;

export const listMemberTitlesQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListMemberTitlesQuery = z.infer<typeof listMemberTitlesQuerySchema>;
```

- [ ] **Step 3: Doğrula**

```bash
node -e "
const { createMemberTitleSchema } = require('./libs/shared-validation/src');
const r = createMemberTitleSchema.safeParse({ name: 'Test', description: 'açıklama' });
console.log('description accepted:', r.success && r.data.description === 'açıklama');
"
```

Beklenen: `description accepted: true`

- [ ] **Step 4: Commit**

```bash
git add libs/shared-validation/src/schemas/title.schema.ts
git commit -m "feat(shared-validation): add description to title schemas"
```

---

## Task 3: Titles Service — `description` Alanını İşle

**Files:**
- Modify: `apps/api/src/modules/titles/titles.service.ts`
- Modify: `apps/api/src/modules/titles/titles.service.spec.ts`

- [ ] **Step 1: Spec'e failing testler ekle**

`apps/api/src/modules/titles/titles.service.spec.ts` dosyasında `sample` objesine `description` ekle ve yeni testler yaz. `sample` objesini şu şekilde güncelle:

```typescript
const sample = {
  id: 'title-1',
  name: 'Teşkilat Başkanı',
  slug: 'teskilat-baskani',
  description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2026-04-24'),
  updatedAt: new Date('2026-04-24'),
};
```

`list` describe bloğuna şu testi ekle:

```typescript
it('includes description in the select clause', async () => {
  prisma.memberTitleDefinition.findMany.mockResolvedValue([sample] as never);

  await service.list();

  expect(prisma.memberTitleDefinition.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      select: expect.objectContaining({ description: true }),
    }),
  );
});
```

`create` describe bloğuna şu testi ekle:

```typescript
it('persists description when provided', async () => {
  prisma.memberTitleDefinition.findUnique.mockResolvedValue(null);
  prisma.memberTitleDefinition.create.mockResolvedValue(sample as never);

  await service.create({
    name: 'Teşkilat Başkanı',
    description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
    sortOrder: 0,
    isActive: true,
  });

  expect(prisma.memberTitleDefinition.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
    }),
  });
});
```

`update` describe bloğuna şu testi ekle:

```typescript
it('updates description when provided', async () => {
  prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
  prisma.memberTitleDefinition.update.mockResolvedValue({
    ...sample,
    description: 'Güncel açıklama',
  } as never);

  const result = await service.update(sample.id, { description: 'Güncel açıklama' });

  expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
    where: { id: sample.id },
    data: { description: 'Güncel açıklama' },
  });
  expect(result.description).toBe('Güncel açıklama');
});

it('clears description when null is passed', async () => {
  prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
  prisma.memberTitleDefinition.update.mockResolvedValue({
    ...sample,
    description: null,
  } as never);

  const result = await service.update(sample.id, { description: null });

  expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
    where: { id: sample.id },
    data: { description: null },
  });
  expect(result.description).toBeNull();
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula**

```bash
nx run api:test -- --testPathPattern=titles.service.spec
```

Beklenen: Yeni testler FAIL (description select/create/update logic eksik)

- [ ] **Step 3: Service'i güncelle**

`apps/api/src/modules/titles/titles.service.ts` dosyasını şu içerikle değiştir:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import {
  CreateMemberTitleInput,
  UpdateMemberTitleInput,
  slugifyTr,
} from '@ticketbot/shared-validation';

@Injectable()
export class TitlesService {
  constructor(private readonly prisma: PrismaService) {}

  list(options: { includeInactive?: boolean } = {}) {
    return this.prisma.memberTitleDefinition.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        isActive: true,
      },
    });
  }

  async create(input: CreateMemberTitleInput) {
    const slug = await this.uniqueSlug(slugifyTr(input.name));
    return this.prisma.memberTitleDefinition.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  }

  async update(id: string, input: UpdateMemberTitleInput) {
    await this.ensureExists(id);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.memberTitleDefinition.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.memberTitleDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.memberTitleDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Unvan bulunamadı');
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 1;
    while (n < 100) {
      const exists = await this.prisma.memberTitleDefinition.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
}
```

- [ ] **Step 4: Tüm testlerin geçtiğini doğrula**

```bash
nx run api:test -- --testPathPattern=titles.service.spec
```

Beklenen: Tüm testler PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/titles/titles.service.ts apps/api/src/modules/titles/titles.service.spec.ts
git commit -m "feat(titles): add description field to list/create/update"
```

---

## Task 4: Seed Verilerini Güncelle

**Files:**
- Modify: `libs/database/prisma/seed.ts`

- [ ] **Step 1: Seed dosyasını güncelle**

`libs/database/prisma/seed.ts` dosyasındaki `TITLES` sabitini ve `for` döngüsünü şu şekilde değiştir:

```typescript
const TITLES: { name: string; description: string }[] = [
  {
    name: 'Teşkilat Başkanı',
    description:
      'Üye kazanımı, üye kaydı, üye takibi, teşkilatlanma, koordinasyon, üye listeleri, iletişim ağı, ziyaret organizasyonu, üye bilgilendirme, katılım artırma, gönüllü yönetimi',
  },
  {
    name: 'Lise Başkanı',
    description:
      'Lise öğrencileri, okul ziyaretleri, lise etkinlikleri, genç üye kazanımı, okul koordinatörleri, lise tanıtımı, öğrenci bilgilendirme, lise temsilcisi',
  },
  {
    name: 'Orta Okul Başkanı',
    description:
      'Ortaokul öğrencileri, ortaokul ziyaretleri, ortaokul etkinlikleri, öğrenci ailesi iletişimi, ortaokul koordinasyonu, tanıtım faaliyetleri',
  },
  {
    name: 'Kadın Kolları Başkanı',
    description:
      'Kadın üyeler, kadın etkinlikleri, hanım toplantıları, kadın dayanışması, kadın kolları organizasyonu, hanımlara yönelik faaliyetler',
  },
  {
    name: 'Kültür-Sanat Sorumlusu',
    description:
      'Kültürel etkinlik, sanat organizasyonu, konser, sergi, tiyatro, şiir gecesi, panel, konferans, kültür programı, sanatsal faaliyet',
  },
  {
    name: 'Gençlik Kolu Sorumlusu',
    description:
      'Gençlik faaliyetleri, genç üyeler, spor etkinlikleri, gezi, kampanya, gençlik buluşması, yaz programı, genç koordinasyon',
  },
  {
    name: 'Medya Sorumlusu',
    description:
      'Sosyal medya, paylaşım, Instagram, Facebook, Twitter, basın açıklaması, haber, fotoğraf, video, dijital içerik, duyuru, tanıtım, web sitesi',
  },
  {
    name: 'Mali İşler Sorumlusu',
    description:
      'Aidat, bütçe, gelir-gider, fatura, muhasebe, mali rapor, ödeme, tahsilat, harcama, finansal planlama, kasa',
  },
];
```

`main()` fonksiyonundaki `for` döngüsünü şu şekilde güncelle:

```typescript
for (let i = 0; i < TITLES.length; i++) {
  const { name, description } = TITLES[i];
  const slug = slugify(name);
  await prisma.memberTitleDefinition.upsert({
    where: { slug },
    update: { name, description, sortOrder: i, isActive: true },
    create: { name, slug, description, sortOrder: i, isActive: true },
  });
}
```

- [ ] **Step 2: Seed'i çalıştır**

```bash
pnpm db:seed
```

Beklenen çıktı: `Seed complete: 8 titles, ...`

- [ ] **Step 3: Açıklamaların yazıldığını doğrula**

```bash
pnpm db:studio
```

Prisma Studio'da `member_title_definitions` tablosunu aç ve `description` kolonunun dolu olduğunu doğrula. Studio'yu kapat.

- [ ] **Step 4: Commit**

```bash
git add libs/database/prisma/seed.ts
git commit -m "feat(seed): add responsibility descriptions to member titles"
```

---

## Task 5: Meetings Service — Zengin Üye Bağlamı

**Files:**
- Modify: `apps/api/src/modules/meetings/meetings.service.ts`
- Modify: `apps/api/src/modules/meetings/meetings.service.spec.ts`

- [ ] **Step 1: Failing test ekle**

`apps/api/src/modules/meetings/meetings.service.spec.ts` dosyasında `analyzeContent` için failing test yaz. Dosyanın mevcut `describe` bloklarına şu bloğu ekle:

```typescript
describe('analyzeContent — member context', () => {
  it('passes role, customTitle and title.description to AI provider', async () => {
    const fakeAi = { extractActionItems: jest.fn().mockResolvedValue({ actionItems: [] }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: fakeAi },
      ],
    }).compile();
    const svc = moduleRef.get(MeetingsService);

    prisma.associationMembership.findMany.mockResolvedValue([
      {
        user: { id: 'u1', fullName: 'Ali Veli' },
        role: 'ASSOCIATION_MANAGER',
        customTitle: null,
        title: { name: 'Teşkilat Başkanı', description: 'Üye kazanımı, koordinasyon' },
      },
      {
        user: { id: 'u2', fullName: 'Ayşe Demir' },
        role: 'ASSOCIATION_MEMBER',
        customTitle: 'Bölge Temsilcisi',
        title: null,
      },
    ] as never);

    await svc.analyzeContent(ASSOC, 'Toplantı notları');

    const [, membersContext] = fakeAi.extractActionItems.mock.calls[0];
    expect(membersContext).toContain('MANAGER (Başkan)');
    expect(membersContext).toContain('Üye kazanımı, koordinasyon');
    expect(membersContext).toContain('Bölge Temsilcisi');
    expect(membersContext).toContain('MEMBER (Üye)');
  });
});
```

Dosyanın başına `AiService` import'unu ekle:

```typescript
import { AiService } from '@ticketbot/ai';
```

- [ ] **Step 2: Testi çalıştır ve başarısız olduğunu doğrula**

```bash
nx run api:test -- --testPathPattern=meetings.service.spec
```

Beklenen: Yeni test FAIL

- [ ] **Step 3: `meetings.service.ts` `analyzeContent` metodunu güncelle**

`analyzeContent` metodunun tamamını şu şekilde değiştir:

```typescript
async analyzeContent(associationId: string, content: string) {
  const members = await this.prisma.associationMembership.findMany({
    where: { associationId, isActive: true, deletedAt: null },
    include: {
      user: { select: { id: true, fullName: true } },
      title: { select: { name: true, description: true } },
    },
  });

  const ROLE_LABEL: Record<string, string> = {
    ASSOCIATION_MANAGER: 'MANAGER (Başkan)',
    ASSOCIATION_SECRETARY: 'SECRETARY (Sekreter)',
    ASSOCIATION_MEMBER: 'MEMBER (Üye)',
    SYSTEM_ADMIN: 'MANAGER (Başkan)',
  };

  const membersContext = members
    .map((m) => {
      const roleLabel = ROLE_LABEL[m.role] ?? m.role;
      const titlePart = m.title
        ? m.title.description
          ? `${m.title.name} — ${m.title.description}`
          : m.title.name
        : 'Atanmamış';
      const customPart = m.customTitle ? `\n  Özel Unvan: ${m.customTitle}` : '';
      return `- User ID: ${m.user.id}\n  İsim: ${m.user.fullName}\n  Sistem Rolü: ${roleLabel}\n  Unvan: ${titlePart}${customPart}`;
    })
    .join('\n');

  try {
    const result = await this.aiService.extractActionItems(content, membersContext);

    const memberMap = new Map(
      members.map((m) => [m.user.id, { fullName: m.user.fullName, title: m.title?.name ?? null }]),
    );

    return {
      actionItems: result.actionItems.map((item) => ({
        ...item,
        assignedToUserName: item.assignedToUserId
          ? (memberMap.get(item.assignedToUserId)?.fullName ?? null)
          : null,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`AI extraction failed: ${message}`, err instanceof Error ? err.stack : undefined);
    throw new InternalServerErrorException(`AI hatası: ${message}`);
  }
}
```

- [ ] **Step 4: Tüm testlerin geçtiğini doğrula**

```bash
nx run api:test -- --testPathPattern=meetings.service.spec
```

Beklenen: Tüm testler PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/meetings/meetings.service.ts apps/api/src/modules/meetings/meetings.service.spec.ts
git commit -m "feat(meetings): enrich member context with role, customTitle and title description"
```

---

## Task 6: System Prompt'u Yeniden Yaz

**Files:**
- Modify: `libs/ai/src/prompts/extract-action-items.prompt.ts`

- [ ] **Step 1: Dosyayı şu içerikle değiştir**

```typescript
export const EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT = `Sen Türk dernek toplantı notlarından görev çıkaran bir yapay zekasın.

## Üye Bağlamı Nasıl Kullanılır

Her üyenin iki sorumluluk katmanı vardır:

1. SİSTEM ROLÜ — hiyerarşiyi ve genel yetkiyi belirler:
   - MANAGER (Başkan): Derneğin genel yönetimi, karar alma, resmi yazışmalar, imza yetkisi, stratejik planlama, dış temsil, yönetim kurulu kararları.
   - SECRETARY (Sekreter): Toplantı tutanakları, evrak takibi, yazışma, belge arşivi, idari organizasyon, gündem hazırlama.
   - MEMBER (Üye): Unvanına ve açıklamasına göre değerlendir.

2. UNVAN + AÇIKLAMA — konu alanını belirler (anahtar kelimeler içerir). Görevin konusu bu anahtar kelimelerle örtüşüyorsa o üyeye ata.

## Atama Kuralları

- Önce unvan/açıklama anahtar kelime eşleşmesine bak. Birden fazla aday varsa en ilgili olanı seç.
- Unvan eşleşmesi yoksa sistem rolüne göre karar ver: genel işler ve kararlar MANAGER'a, idari ve evrak işleri SECRETARY'ye.
- Notta isim açıkça geçiyorsa doğrudan o kişiye ata — isim eşleşmesi her şeyin önünde gelir.
- Görevler mümkün olduğunca farklı üyelere dağıtılmaya çalışılmalı, ancak konu alanı eşleşmesi her zaman önceliklidir. Bir unvana ait birden fazla görev çıktıysa ve o alanda yeterli üye yoksa, aynı kişiye birden fazla görev atanabilir — yanlış kişiye atamak yerine doğru kişiye yığmak tercih edilir.
- Hiçbir üye için yapay görev üretme — notlarda karşılığı olmayan görev atama.
- Eşleşen kimse yoksa assignedToUserId null bırak.

## Çıktı Kuralları

- title: ≤80 karakter, notların dilinde (Türkçe ya da ne ise).
- description: notlardan 1-2 cümle bağlam; başlıktan açıksa null.
- Yalnızca somut, eyleme geçilebilir görevler — genel tartışma ve alınan kararları atlat.
- SADECE geçerli JSON döndür, başka hiçbir şey yazma:
{"actionItems": [{"title": "...", "description": "..." | null, "assignedToUserId": "..." | null}]}`;

export function buildExtractionUserPrompt(meetingNotes: string, membersContext: string): string {
  return `Üyeler:\n${membersContext}\n\nToplantı Notları:\n${meetingNotes}`;
}
```

- [ ] **Step 2: TypeScript derleme hatası olmadığını doğrula**

```bash
nx run api:build 2>&1 | tail -20
```

Beklenen: Build başarılı, hata yok.

- [ ] **Step 3: Commit**

```bash
git add libs/ai/src/prompts/extract-action-items.prompt.ts
git commit -m "feat(ai): rewrite extraction prompt with role-aware assignment rules"
```

---

## Task 7: Tüm Testleri Çalıştır ve Doğrula

- [ ] **Step 1: API test suite'ini çalıştır**

```bash
nx run api:test
```

Beklenen: Tüm testler PASS, 0 failure.

- [ ] **Step 2: Lint kontrolü**

```bash
pnpm lint
```

Beklenen: 0 hata.

- [ ] **Step 3: Final commit yoksa özet commit**

Eğer uncommitted değişiklik kalmadıysa bu adımı atla. Kaldıysa:

```bash
git add -A
git commit -m "chore: finalize ai task assignment prompt improvement"
```
