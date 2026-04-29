# Genel Başkan Dashboard & Şube Kartları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Genel Başkan (SYSTEM_ADMIN) ekranına ayrı bir dashboard sayfası ekle, şubeler sayfasını kart grid'e çevir ve şube detay modalı ekle.

**Architecture:** API katmanına global stats endpoint'i eklenir; frontend'e `/dashboard` Server Component sayfası + kart grid + detay modalı eklenir; manuel şube oluşturma akışı frontend'den kaldırılır (backend endpoint korunur).

**Tech Stack:** NestJS 11 / Fastify, Prisma, Next.js 15 App Router, Tailwind CSS, TypeScript

---

## File Map

| Eylem | Dosya |
|---|---|
| Modify | `libs/shared-types/src/domain/association.ts` |
| Modify | `libs/shared-types/src/index.ts` |
| Modify | `apps/api/src/modules/associations/associations.service.ts` |
| Modify | `apps/api/src/modules/associations/associations.service.spec.ts` |
| Modify | `apps/api/src/modules/associations/associations.controller.ts` |
| Modify | `apps/web/src/lib/api/associations.ts` |
| **Create** | `apps/web/src/app/(protected)/dashboard/page.tsx` |
| Modify | `apps/web/src/app/(protected)/_components/app-shell.tsx` |
| Modify | `apps/web/src/app/(protected)/associations/page.tsx` |
| Modify | `apps/web/src/app/(protected)/associations/_components/associations-list.tsx` |
| Modify | `apps/web/src/app/(protected)/associations/_components/association-card.tsx` |
| **Create** | `apps/web/src/app/(protected)/associations/_components/branch-detail-modal.tsx` |
| Delete | `apps/web/src/app/(protected)/associations/new/page.tsx` |
| Delete | `apps/web/src/app/(protected)/associations/_components/association-form.tsx` |
| Delete | `apps/web/src/app/(protected)/associations/_components/association-table.tsx` |
| Delete | `apps/web/src/app/(protected)/associations/_hooks/use-create-association.ts` |

---

### Task 1: `GlobalBranchStatsDto` tipini shared-types'a ekle

**Files:**
- Modify: `libs/shared-types/src/domain/association.ts`
- Modify: `libs/shared-types/src/index.ts`

- [ ] **Step 1: `association.ts` dosyasına yeni interface ekle**

`libs/shared-types/src/domain/association.ts` dosyasının sonuna ekle:

```ts
export interface GlobalBranchStatsDto {
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
  totalMembers: number;
  pendingRegistrations: number;
  cityDistribution: { city: string; count: number }[];
}
```

- [ ] **Step 2: `index.ts`'ten export et**

`libs/shared-types/src/index.ts` içindeki association export satırını güncelle:

```ts
export type {
  AssociationDto,
  AssociationListResponse,
  AssociationStatsDto,
  GlobalBranchStatsDto,
} from './domain/association';
```

- [ ] **Step 3: Derle ve kontrol et**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter @ticketbot/shared-types build 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add libs/shared-types/src/domain/association.ts libs/shared-types/src/index.ts
git commit -m "feat(shared-types): add GlobalBranchStatsDto"
```

---

### Task 2: API — global stats endpoint ekle

**Files:**
- Modify: `apps/api/src/modules/associations/associations.service.ts`
- Modify: `apps/api/src/modules/associations/associations.controller.ts`

- [ ] **Step 1: `associations.service.ts`'e `getGlobalStats` metodu ekle**

`AssociationsService` class'ının içine, mevcut `getStats` metodundan ÖNCE ekle:

```ts
async getGlobalStats() {
  const [
    totalBranches,
    activeBranches,
    totalMembers,
    pendingRegistrations,
    cityRaw,
  ] = await this.prisma.$transaction([
    this.prisma.association.count({ where: { deletedAt: null } }),
    this.prisma.association.count({ where: { deletedAt: null, isActive: true } }),
    this.prisma.associationMembership.count({
      where: { isActive: true, deletedAt: null },
    }),
    this.prisma.pendingBranchRegistration.count({
      where: { status: 'PENDING' },
    }),
    this.prisma.association.groupBy({
      by: ['city'],
      where: { deletedAt: null },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    totalBranches,
    activeBranches,
    inactiveBranches: totalBranches - activeBranches,
    totalMembers,
    pendingRegistrations,
    cityDistribution: cityRaw.map((r) => ({
      city: r.city,
      count: r._count.city,
    })),
  };
}
```

- [ ] **Step 2: Controller'a `GET /associations/stats` handler ekle**

`associations.controller.ts` içinde `@Get(':id/stats')` satırından ÖNCE aşağıdaki handler'ı ekle (literal route parametrik route'dan önce olmalı):

```ts
@Get('stats')
@Roles(UserRole.SYSTEM_ADMIN)
getGlobalStats() {
  return this.associationsService.getGlobalStats();
}
```

- [ ] **Step 3: API testlerini çalıştır**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
nx run api:test -- --testPathPattern=associations 2>&1 | tail -20
```

Beklenen: tüm mevcut testler geçer.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/associations/associations.service.ts \
        apps/api/src/modules/associations/associations.controller.ts
git commit -m "feat(api): add GET /associations/stats global branch stats endpoint"
```

---

### Task 3: API service için test ekle

**Files:**
- Modify: `apps/api/src/modules/associations/associations.service.spec.ts`

- [ ] **Step 1: `getGlobalStats` için birim testi ekle**

`associations.service.spec.ts` dosyasını aç. Mevcut describe bloğunun içine aşağıdaki testi ekle (diğer testlerin yanına):

```ts
describe('getGlobalStats', () => {
  it('should return aggregated stats', async () => {
    // Prisma mock'u için $transaction'ı stub et
    const mockResult = [
      5,    // totalBranches
      4,    // activeBranches
      23,   // totalMembers
      2,    // pendingRegistrations
      [     // cityRaw
        { city: 'İstanbul', _count: { city: 3 } },
        { city: 'Ankara', _count: { city: 2 } },
      ],
    ];
    jest.spyOn(prisma, '$transaction').mockResolvedValueOnce(mockResult as any);

    const result = await service.getGlobalStats();

    expect(result).toEqual({
      totalBranches: 5,
      activeBranches: 4,
      inactiveBranches: 1,
      totalMembers: 23,
      pendingRegistrations: 2,
      cityDistribution: [
        { city: 'İstanbul', count: 3 },
        { city: 'Ankara', count: 2 },
      ],
    });
  });
});
```

- [ ] **Step 2: Testi çalıştır**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
nx run api:test -- --testPathPattern=associations.service 2>&1 | tail -20
```

Beklenen: yeni test dahil tümü PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/associations/associations.service.spec.ts
git commit -m "test(api): add getGlobalStats unit test"
```

---

### Task 4: Web API client'a `getGlobalBranchStats` ekle

**Files:**
- Modify: `apps/web/src/lib/api/associations.ts`

- [ ] **Step 1: Fonksiyonu ekle**

`apps/web/src/lib/api/associations.ts` dosyasının en sonuna ekle:

```ts
import type { ..., GlobalBranchStatsDto } from '@ticketbot/shared-types';

export function getGlobalBranchStats(token: string) {
  return apiClient<GlobalBranchStatsDto>('/associations/stats', { token });
}
```

Not: Dosyanın başındaki `import type { AssociationDto, AssociationListResponse, AssociationStatsDto }` satırına `GlobalBranchStatsDto` ekle:

```ts
import type {
  AssociationDto,
  AssociationListResponse,
  AssociationStatsDto,
  GlobalBranchStatsDto,
} from '@ticketbot/shared-types';
```

- [ ] **Step 2: TypeScript derle**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter web build 2>&1 | grep -E "error|Error" | head -10
```

Beklenen: type error yok.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/associations.ts
git commit -m "feat(web): add getGlobalBranchStats API client function"
```

---

### Task 5: Dashboard sayfası oluştur

**Files:**
- Create: `apps/web/src/app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Dashboard sayfasını oluştur**

`apps/web/src/app/(protected)/dashboard/page.tsx` dosyasını oluştur:

```tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { getGlobalBranchStats } from '@/lib/api/associations';
import { listPendingRegistrations } from '@/lib/api/auth';
import {
  Building2,
  CheckCircle2,
  Clock,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { GlobalBranchStatsDto } from '@ticketbot/shared-types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  try {
    const me = await getMe(session.access_token);
    if (!isSystemAdmin(me)) redirect('/associations');
  } catch {
    redirect('/associations');
  }

  let stats: GlobalBranchStatsDto = {
    totalBranches: 0,
    activeBranches: 0,
    inactiveBranches: 0,
    totalMembers: 0,
    pendingRegistrations: 0,
    cityDistribution: [],
  };

  try {
    stats = await getGlobalBranchStats(session.access_token);
  } catch {
    // stats defaults korunur
  }

  const maxCityCount = stats.cityDistribution[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <span className="eyebrow">Yönetim Paneli</span>
        <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Genel Bakış
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tüm şubelerin güncel istatistikleri
        </p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Toplam Şube"
          value={stats.totalBranches}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          label="Aktif Şube"
          value={stats.activeBranches}
          valueClass="text-green-700 dark:text-green-400"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-muted-foreground" />}
          label="Pasif Şube"
          value={stats.inactiveBranches}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Toplam Üye"
          value={stats.totalMembers}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Bekleyen Başvuru"
          value={stats.pendingRegistrations}
          highlight={stats.pendingRegistrations > 0}
          action={
            stats.pendingRegistrations > 0
              ? { href: '/admin/pending-registrations', label: 'İncele' }
              : undefined
          }
        />
      </div>

      {/* City Distribution */}
      {stats.cityDistribution.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Şehir Dağılımı
          </h2>
          <div className="space-y-3">
            {stats.cityDistribution.map(({ city, count }) => (
              <div key={city} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[13px] font-medium text-foreground">
                  {city}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.round((count / maxCityCount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[12px] tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
  highlight,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClass?: string;
  highlight?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
        >
          {icon}
        </span>
        {action && (
          <Link
            href={action.href}
            className="text-[11px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div
        className={`mt-3 text-3xl font-bold tabular-nums tracking-tight ${valueClass ?? 'text-foreground'}`}
      >
        {value.toLocaleString('tr-TR')}
      </div>
      <div className="mt-1 text-[12.5px] text-muted-foreground">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Next.js build ile hata kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter web build 2>&1 | grep -E "error TS|Type error" | head -10
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(protected)/dashboard/page.tsx
git commit -m "feat(web): add /dashboard page with global branch stats"
```

---

### Task 6: Navigasyonu güncelle

**Files:**
- Modify: `apps/web/src/app/(protected)/_components/app-shell.tsx`

- [ ] **Step 1: `Home` ikonunu import listesine ekle**

`app-shell.tsx` dosyasının lucide-react import satırını güncelle, `Home` ekle:

```ts
import {
  AlertTriangle,
  BookOpen,
  BookUser,
  ClipboardList,
  Crown,
  Home,
  Info,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
```

- [ ] **Step 2: `buildNav` fonksiyonunu güncelle**

`buildNav` içindeki `isSystemAdmin(user)` bloğunu değiştir:

```ts
if (isSystemAdmin(user)) {
  return [
    { href: '/dashboard', label: 'Ana Sayfa', icon: Home, primary: true },
    { href: '/associations', label: 'Şubeler', icon: BookUser, primary: true },
    { href: '/admin/pending-registrations', label: 'Başvurular', icon: UserCheck, primary: true },
    { href: '/settings', label: 'Ayarlar', icon: Settings },
  ];
}
```

- [ ] **Step 3: `isNavActive` fonksiyonunu güncelle**

`isNavActive` fonksiyonunda `/associations` bloğunu daralt ve `/dashboard` bloğu ekle:

```ts
// /dashboard — exact match
if (item.href === '/dashboard') {
  return pathname === '/dashboard';
}

// /associations — sadece liste sayfası (artık /associations/new yok)
if (item.href === '/associations') {
  return pathname === '/associations';
}
```

Not: `/associations/:id` detay sayfaları nav'da aktif görünmeyecek — bu doğru davranış, SYSTEM_ADMIN şube detayına nadiren girer.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(protected)/_components/app-shell.tsx
git commit -m "feat(web): add /dashboard to SYSTEM_ADMIN nav as 'Ana Sayfa'"
```

---

### Task 7: AssociationCard'ı yeniden tasarla

**Files:**
- Modify: `apps/web/src/app/(protected)/associations/_components/association-card.tsx`

- [ ] **Step 1: Dosyayı komple yeniden yaz**

`association-card.tsx` dosyasını aşağıdaki içerikle değiştir:

```tsx
import { MapPin, MoveRight, Users } from 'lucide-react';
import type { AssociationDto } from '@ticketbot/shared-types';
import { Badge } from '@/components/ui/badge';

interface AssociationCardProps {
  association: AssociationDto;
  onClick: (id: string) => void;
  loading?: boolean;
}

export function AssociationCard({ association, onClick, loading }: AssociationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(association.id)}
      disabled={loading}
      className="group relative w-full cursor-pointer rounded-xl border border-border bg-card p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground group-hover:text-primary">
            {association.name}
          </h3>
          {association.shortName && (
            <p className="text-[11.5px] text-muted-foreground">{association.shortName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={association.isActive ? 'success' : 'outline'}>
            {association.isActive ? 'Aktif' : 'Pasif'}
          </Badge>
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <MoveRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[12.5px] text-muted-foreground">
        <Meta icon={<MapPin className="h-3.5 w-3.5" />}>
          {association.city} / {association.district}
        </Meta>
        <Meta icon={<Users className="h-3.5 w-3.5" />}>
          <span className="tabular-nums">{association.memberCount}</span> üye
        </Meta>
      </dl>
    </button>
  );
}

function Meta({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(protected)/associations/_components/association-card.tsx
git commit -m "feat(web): redesign AssociationCard with gradient hover animation and onClick"
```

---

### Task 8: Şube detay modalını oluştur

**Files:**
- Create: `apps/web/src/app/(protected)/associations/_components/branch-detail-modal.tsx`

- [ ] **Step 1: Modal dosyasını oluştur**

`apps/web/src/app/(protected)/associations/_components/branch-detail-modal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, User, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { getAssociation } from '@/lib/api/associations';
import { listMembers } from '@/lib/api/members';
import type { AssociationDto } from '@ticketbot/shared-types';
import type { MemberResponse } from '@ticketbot/shared-validation';
import Link from 'next/link';

interface BranchDetailModalProps {
  associationId: string | null;
  onClose: () => void;
}

export function BranchDetailModal({ associationId, onClose }: BranchDetailModalProps) {
  const [branch, setBranch] = useState<AssociationDto | null>(null);
  const [manager, setManager] = useState<MemberResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!associationId) return;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(false);
      setBranch(null);
      setManager(null);

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const [branchData, members] = await Promise.all([
          getAssociation(session.access_token, associationId!),
          listMembers(session.access_token, associationId!, {
            role: 'ASSOCIATION_MANAGER',
            isActive: true,
          }),
        ]);

        if (!cancelled) {
          setBranch(branchData);
          setManager(members[0] ?? null);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [associationId]);

  if (!associationId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:w-full">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Şube bilgileri yüklenemedi.
            <Button variant="ghost" size="sm" className="mt-3 block mx-auto" onClick={onClose}>
              Kapat
            </Button>
          </div>
        )}

        {!loading && !error && branch && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
              <div className="space-y-1">
                <Badge variant={branch.isActive ? 'success' : 'outline'} className="mb-1">
                  {branch.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
                <h2 className="text-[17px] font-bold leading-tight text-foreground">
                  {branch.name}
                </h2>
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {branch.city} / {branch.district}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats mini-grid */}
            <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
              <div className="bg-card px-6 py-4">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Aktif Üye
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {branch.memberCount.toLocaleString('tr-TR')}
                </div>
              </div>
              <div className="bg-card px-6 py-4">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Durum
                </div>
                <div className={`mt-1 text-[15px] font-semibold ${branch.isActive ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {branch.isActive ? 'Aktif' : 'Pasif'}
                </div>
              </div>
            </div>

            {/* İletişim */}
            <div className="border-b border-border px-6 py-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                İletişim
              </p>
              <div className="space-y-2">
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />}>
                  <a href={`mailto:${branch.email}`} className="hover:underline">
                    {branch.email}
                  </a>
                </InfoRow>
                {branch.phone && (
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />}>
                    {branch.phone}
                  </InfoRow>
                )}
              </div>
            </div>

            {/* Başkan */}
            <div className="px-6 py-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Başkan
              </p>
              {manager ? (
                <div className="space-y-2">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />}>
                    <span className="font-medium">{manager.user.fullName}</span>
                  </InfoRow>
                  {manager.user.email && (
                    <InfoRow icon={<Mail className="h-3.5 w-3.5" />}>
                      <a href={`mailto:${manager.user.email}`} className="hover:underline">
                        {manager.user.email}
                      </a>
                    </InfoRow>
                  )}
                  {manager.user.phone && (
                    <InfoRow icon={<Phone className="h-3.5 w-3.5" />}>
                      {manager.user.phone}
                    </InfoRow>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">Başkan bulunamadı</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4">
              <Button asChild className="w-full">
                <Link href={`/associations/${branch.id}`}>
                  Şubeye Git
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function InfoRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(protected)/associations/_components/branch-detail-modal.tsx
git commit -m "feat(web): add BranchDetailModal component with live branch data"
```

---

### Task 9: Associations list sayfasını güncelle

**Files:**
- Modify: `apps/web/src/app/(protected)/associations/_components/associations-list.tsx`
- Modify: `apps/web/src/app/(protected)/associations/page.tsx`

- [ ] **Step 1: `associations-list.tsx`'i yeniden yaz**

Tüm dosyayı aşağıdaki içerikle değiştir:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import type { AssociationListResponse } from '@ticketbot/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAssociations } from '../_hooks/use-associations';
import { AssociationCard } from './association-card';
import { BranchDetailModal } from './branch-detail-modal';
import { EmptyState } from './empty-state';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function AssociationsList({
  initialData,
}: {
  initialData: AssociationListResponse;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const search = useDebounced(searchInput);

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      isActive:
        status === 'active' ? true : status === 'inactive' ? false : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, status, page],
  );

  const hasFilters = params.search !== undefined || params.isActive !== undefined;
  const useInitial = !hasFilters && page === 1;

  const { data, isLoading, isFetching } = useAssociations(
    params,
    useInitial ? { initialData } : undefined,
  );

  const rows = data?.data ?? [];
  const meta = data?.meta ?? initialData.meta;

  function resetFilters() {
    setSearchInput('');
    setStatus('all');
    setPage(1);
  }

  function handleCardClick(id: string) {
    setLoadingId(id);
    setSelectedId(id);
  }

  function handleModalClose() {
    setSelectedId(null);
    setLoadingId(null);
  }

  return (
    <>
      <div className="space-y-8">
        <PageHeader total={meta.total} isFetching={isFetching} />

        <FilterBar
          searchInput={searchInput}
          status={status}
          hasFilters={hasFilters}
          onSearch={(v) => { setSearchInput(v); setPage(1); }}
          onStatus={(v) => { setStatus(v); setPage(1); }}
          onReset={resetFilters}
        />

        {isLoading ? (
          <GridSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={resetFilters} canCreate={false} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((a) => (
                <AssociationCard
                  key={a.id}
                  association={a}
                  onClick={handleCardClick}
                  loading={loadingId === a.id && selectedId === a.id}
                />
              ))}
            </div>

            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              shown={rows.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        )}
      </div>

      <BranchDetailModal
        associationId={selectedId}
        onClose={handleModalClose}
      />
    </>
  );
}

function PageHeader({
  total,
  isFetching,
}: {
  total: number;
  isFetching: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="space-y-1.5">
        <span className="eyebrow">Şube Sicili</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Şubeler
        </h1>
        <p className="text-sm text-muted-foreground">
          Toplam{' '}
          <span className="font-semibold tabular-nums text-foreground">{total}</span>{' '}
          şube.
          {isFetching && (
            <span className="ml-1.5 text-muted-foreground/70">güncelleniyor…</span>
          )}
        </p>
      </div>
    </header>
  );
}

function FilterBar({
  searchInput,
  status,
  hasFilters,
  onSearch,
  onStatus,
  onReset,
}: {
  searchInput: string;
  status: 'all' | 'active' | 'inactive';
  hasFilters: boolean;
  onSearch: (v: string) => void;
  onStatus: (v: 'all' | 'active' | 'inactive') => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Ad ile ara…"
          value={searchInput}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="w-40">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm durumlar</SelectItem>
          <SelectItem value="active">Yalnızca aktif</SelectItem>
          <SelectItem value="inactive">Yalnızca pasif</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-3.5 w-3.5" />
          Filtreleri sıfırla
        </Button>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="mt-4 flex gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  shown,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  shown: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, from + shown - 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <span className="text-[13px] text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span>
        <span className="mx-1 text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">{total}</span> arasındaki kayıtlar
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Önceki
        </Button>
        <span className="px-2 text-[13px] tabular-nums text-muted-foreground">
          Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          Sonraki
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `associations/page.tsx`'i güncelle**

`canCreate` prop'unu ve Yeni Dernek mantığını kaldır. Tek-üyelik redirect'i koru (şube başkanları hâlâ kendi şubelerine yönlendirilmeli). Tüm dosyayı şununla değiştir:

```tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { listAssociations } from '@/lib/api/associations';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin, activeMemberships } from '@/lib/permissions';
import type { AssociationListResponse } from '@ticketbot/shared-types';
import { AssociationsList } from './_components/associations-list';

const EMPTY: AssociationListResponse = {
  data: [],
  meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 },
};

export default async function AssociationsPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    try {
      const me = await getMe(session.access_token);
      // Non-admin users with a single active membership go directly to that association
      if (!isSystemAdmin(me)) {
        const active = activeMemberships(me);
        if (active.length === 1) {
          redirect(`/associations/${active[0].associationId}`);
        }
      }
    } catch {
      // devam et
    }
  }

  let initialData = EMPTY;
  if (session) {
    try {
      initialData = await listAssociations(session.access_token, {
        page: 1,
        pageSize: 20,
      });
    } catch {
      initialData = EMPTY;
    }
  }

  return <AssociationsList initialData={initialData} />;
}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter web build 2>&1 | grep -E "error TS|Type error" | head -10
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(protected)/associations/_components/associations-list.tsx \
        apps/web/src/app/(protected)/associations/page.tsx
git commit -m "feat(web): rework associations page to card grid, remove create flow"
```

---

### Task 10: Kullanılmayan dosyaları sil

**Files:**
- Delete: `apps/web/src/app/(protected)/associations/new/page.tsx`
- Delete: `apps/web/src/app/(protected)/associations/_components/association-form.tsx`
- Delete: `apps/web/src/app/(protected)/associations/_components/association-table.tsx`
- Delete: `apps/web/src/app/(protected)/associations/_hooks/use-create-association.ts`

- [ ] **Step 1: Dosyaları sil**

```bash
rm apps/web/src/app/(protected)/associations/new/page.tsx
rm apps/web/src/app/(protected)/associations/_components/association-form.tsx
rm apps/web/src/app/(protected)/associations/_components/association-table.tsx
rm apps/web/src/app/(protected)/associations/_hooks/use-create-association.ts
```

- [ ] **Step 2: `new/` dizini boş kaldıysa sil**

```bash
rmdir apps/web/src/app/(protected)/associations/new 2>/dev/null || true
```

- [ ] **Step 3: Build ile kırık import kontrolü**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter web build 2>&1 | grep -E "error TS|Module not found|Cannot find" | head -10
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(web): remove manual association create flow and unused files"
```

---

### Task 11: Son kontrol

- [ ] **Step 1: API testlerini çalıştır**

```bash
cd /Users/mzeyneloglu/Projeler/Association-Organizer
pnpm --filter api test 2>&1 | tail -10
```

Beklenen: tüm testler PASS.

- [ ] **Step 2: Web build**

```bash
pnpm --filter web build 2>&1 | tail -10
```

Beklenen: başarılı build.

- [ ] **Step 3: Dev server'ı başlat ve manuel test**

```bash
pnpm dev:api &
pnpm dev:web &
```

Kontrol listesi:
- [ ] `/dashboard` sayfası açılıyor, stat kartları görünüyor
- [ ] Nav'da "Ana Sayfa" → `/dashboard` aktif
- [ ] Nav'da "Şubeler" → `/associations` aktif
- [ ] Şubeler sayfasında kart grid görünüyor
- [ ] Karta hover'da gradient + scale animasyonu çalışıyor
- [ ] Karta tıklayınca modal açılıyor, başkan bilgisi geliyor
- [ ] Modalda "Şubeye Git" butonu `/associations/:id`'ye götürüyor
- [ ] `/associations/new` 404 veriyor
