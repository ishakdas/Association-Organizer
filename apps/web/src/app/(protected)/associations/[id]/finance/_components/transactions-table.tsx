'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReceiptViewer } from './receipt-viewer';
import { exportToExcel } from './export-utils';
import type { TransactionResponse, TransactionCategoryResponse } from '@ticketbot/shared-validation';

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

interface Props {
  transactions: TransactionResponse[];
  categories: TransactionCategoryResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  onPageChange: (page: number) => void;
  onFilterChange: (filters: {
    type?: 'INCOME' | 'EXPENSE';
    categoryId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) => void;
  associationId: string;
}

export function TransactionsTable({
  transactions,
  categories,
  meta,
  onPageChange,
  onFilterChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        !search ||
        tx.description?.toLowerCase().includes(search.toLowerCase()) ||
        categories.find((c) => c.id === tx.categoryId)?.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchesCategory = categoryFilter === 'ALL' || tx.categoryId === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, search, typeFilter, categoryFilter, categories]);

  const handleFilterApply = () => {
    onFilterChange({
      type: typeFilter === 'ALL' ? undefined : (typeFilter as 'INCOME' | 'EXPENSE'),
      categoryId: categoryFilter === 'ALL' ? undefined : categoryFilter,
      search: search || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };

  const handleExport = () => {
    exportToExcel(
      filteredTransactions.map((tx) => ({
        ...tx,
        category: categories.find((c) => c.id === tx.categoryId),
      })),
      `finans-islemleri-${new Date().toISOString().split('T')[0]}`,
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            İşlem Geçmişi
            <Badge variant="secondary" className="text-[10px]">
              {meta.total}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-xs">
            <Download className="mr-1 h-3 w-3" />
            Excel
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Açıklama veya kategori ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tümü</SelectItem>
              <SelectItem value="INCOME">Gelir</SelectItem>
              <SelectItem value="EXPENSE">Gider</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm Kategoriler</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[130px] h-8 text-xs"
            placeholder="Başlangıç"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[130px] h-8 text-xs"
            placeholder="Bitiş"
          />
          <Button variant="secondary" size="sm" onClick={handleFilterApply} className="h-8 text-xs">
            <Filter className="mr-1 h-3 w-3" />
            Filtrele
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/30 px-4 py-2 text-[10px] font-medium text-muted-foreground sm:grid">
            <span>İşlem</span>
            <span className="text-center">Kategori</span>
            <span className="text-center">Tarih</span>
            <span className="text-right">Tutar</span>
          </div>
          <div className="divide-y">
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Filtrelere uygun işlem bulunamadı.
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx, index) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const isIncome = tx.type === 'INCOME';
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-muted/30 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-2 sm:px-4"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {tx.description || cat?.name || 'İşlem'}
                        </p>
                        <div className="flex items-center gap-1">
                          <ReceiptViewer receiptUrl={tx.receiptUrl} description={tx.description} />
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right text-xs font-bold tabular-nums sm:hidden ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {kurusToTl(tx.amountInKurus)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-8 text-[10px] text-muted-foreground sm:hidden">
                      {cat?.name ? (
                        <Badge variant="outline" className="text-[9px] font-normal px-1.5 py-0">
                          {cat.name}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <span>
                        {new Date(tx.transactionDate).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="hidden text-center sm:block">
                      {cat?.name && (
                        <Badge variant="outline" className="text-[9px] font-normal px-1.5 py-0">
                          {cat.name}
                        </Badge>
                      )}
                    </div>
                    <div className="hidden text-center text-[10px] text-muted-foreground sm:block">
                      {new Date(tx.transactionDate).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div
                      className={`hidden text-right text-xs font-bold tabular-nums sm:block ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {kurusToTl(tx.amountInKurus)}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Sayfa {meta.page} / {meta.totalPages} ({meta.total} kayıt)
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(meta.page - 1)}
                disabled={meta.page <= 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2">
                {meta.page} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
