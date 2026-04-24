'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
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
import { AssociationTable } from './association-table';
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
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const search = useDebounced(searchInput);

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      isActive:
        status === 'active' ? true : status === 'inactive' ? false : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, city, status, page],
  );

  const hasFilters =
    params.search !== undefined ||
    params.city !== undefined ||
    params.isActive !== undefined;

  const useInitial = !hasFilters && page === 1;

  const { data, isLoading, isFetching } = useAssociations(
    params,
    useInitial ? { initialData } : undefined,
  );

  const rows = data?.data ?? [];
  const meta = data?.meta ?? initialData.meta;

  function resetFilters() {
    setSearchInput('');
    setCity('');
    setStatus('all');
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader total={meta.total} isFetching={isFetching} />

      <FilterBar
        searchInput={searchInput}
        city={city}
        status={status}
        hasFilters={hasFilters}
        onSearch={(v) => {
          setSearchInput(v);
          setPage(1);
        }}
        onCity={(v) => {
          setCity(v);
          setPage(1);
        }}
        onStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        onReset={resetFilters}
      />

      {isLoading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden md:block">
            <AssociationTable rows={rows} />
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((a) => (
              <AssociationCard key={a.id} association={a} />
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
        <span className="eyebrow">Kayıtlı Dernekler</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Dernek Sicili
        </h1>
        <p className="text-sm text-muted-foreground">
          Toplam{' '}
          <span className="font-semibold tabular-nums text-foreground">{total}</span>{' '}
          kayıt.
          {isFetching && (
            <span className="ml-1.5 text-muted-foreground/70">güncelleniyor…</span>
          )}
        </p>
      </div>
      <Button asChild size="default">
        <Link href="/associations/new">
          <Plus className="h-4 w-4" />
          Yeni Dernek
        </Link>
      </Button>
    </header>
  );
}

function FilterBar({
  searchInput,
  city,
  status,
  hasFilters,
  onSearch,
  onCity,
  onStatus,
  onReset,
}: {
  searchInput: string;
  city: string;
  status: 'all' | 'active' | 'inactive';
  hasFilters: boolean;
  onSearch: (v: string) => void;
  onCity: (v: string) => void;
  onStatus: (v: 'all' | 'active' | 'inactive') => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Ad veya VKN ile ara…"
          value={searchInput}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <Input
        placeholder="Şehir"
        className="w-36"
        value={city}
        onChange={(e) => onCity(e.target.value)}
      />
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

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-6 px-4 py-4',
            i < 4 && 'border-b border-border/70',
          )}
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
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
        <span className="font-medium text-foreground">{total}</span> arasındaki
        kayıtlar
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={onPrev}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Önceki
        </Button>
        <span className="px-2 text-[13px] tabular-nums text-muted-foreground">
          Sayfa <span className="font-medium text-foreground">{page}</span> /{' '}
          {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Sonraki
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
