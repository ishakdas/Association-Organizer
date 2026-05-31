'use client';

import { useMemo, useState } from 'react';
import { HandCoins, Inbox, Search } from 'lucide-react';
import type { DonationCategoryResponse } from '@ticketbot/shared-validation';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminDonationCategories } from '../_hooks/use-admin-donation-categories';
import { CreateDonationCategoryDialog } from './create-donation-category-dialog';
import { DeleteDonationCategoryDialog } from './delete-donation-category-dialog';
import { DonationCategoryRow } from './donation-category-row';

export function DonationCategoriesManager({
  initialData,
}: {
  initialData: DonationCategoryResponse[];
}) {
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] =
    useState<DonationCategoryResponse | null>(null);

  const { data, isLoading, isFetching } = useAdminDonationCategories({
    initialData,
  });
  const categories = data ?? initialData;

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr-TR').includes(q) ||
        c.slug.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [categories, search]);

  const activeCount = categories.filter((c) => c.isActive).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <div className="space-y-8">
      <PageHeader
        total={categories.length}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        isFetching={isFetching}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Bağış türü ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={search.length > 0} total={categories.length} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Sıra</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <DonationCategoryRow
                  key={c.id}
                  category={c}
                  onRequestDelete={setPendingDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DeleteDonationCategoryDialog
        category={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function PageHeader({
  total,
  activeCount,
  inactiveCount,
  isFetching,
}: {
  total: number;
  activeCount: number;
  inactiveCount: number;
  isFetching: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="space-y-1.5">
        <span className="eyebrow inline-flex items-center gap-1.5">
          <HandCoins className="h-3 w-3" />
          Sistem Yönetimi
        </span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Bağış Türleri
        </h1>
        <p className="text-sm text-muted-foreground">
          Tüm derneklerin /bagis menüsünde görünen ortak türler. Toplam{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {total}
          </span>{' '}
          tür —{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {activeCount}
          </span>{' '}
          aktif,{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {inactiveCount}
          </span>{' '}
          pasif.
          {isFetching && (
            <span className="ml-1.5 text-muted-foreground/70">
              güncelleniyor…
            </span>
          )}
        </p>
      </div>
      <CreateDonationCategoryDialog />
    </header>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasQuery,
  total,
}: {
  hasQuery: boolean;
  total: number;
}) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Eşleşen bağış türü yok
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Arama terimini değiştir veya temizle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {total === 0 ? 'Henüz bağış türü yok' : 'Kayıt yok'}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Sağ üstteki <span className="font-medium">Yeni Bağış Türü</span>{' '}
          butonundan ilk türü ekle.
        </p>
      </div>
    </div>
  );
}
