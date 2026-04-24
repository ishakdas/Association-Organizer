'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dernek Sicili</h1>
          <p className="text-sm text-muted-foreground">
            Kayıtlı dernekler. Yeni kayıt ekleyebilir, detayları görüntüleyebilirsiniz.
          </p>
        </div>
        <Button asChild>
          <Link href="/associations/new">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Dernek
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Ad veya VKN ara..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Input
          placeholder="Şehir"
          className="w-40"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onValueChange={(v: 'all' | 'active' | 'inactive') => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Pasif</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchInput('');
              setCity('');
              setStatus('all');
              setPage(1);
            }}
          >
            Filtreleri sıfırla
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <div className="hidden md:block">
            <AssociationTable rows={rows} />
          </div>
          <div className="grid gap-4 md:hidden">
            {rows.map((a) => (
              <AssociationCard key={a.id} association={a} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Toplam <strong className="text-foreground">{meta.total}</strong> kayıt
              {isFetching && ' • güncelleniyor...'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <span className="tabular-nums">
                {meta.page} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
