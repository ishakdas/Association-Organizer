'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Banknote,
  BarChart3,
  CalendarDays,
  X,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { listTransactions } from '@/lib/api/finance';
import type {
  FinanceSummaryResponse,
  TransactionResponse,
  TransactionCategoryResponse,
} from '@ticketbot/shared-validation';

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

interface MonthlyStat {
  label: string;
  incomeKurus: number;
  expenseKurus: number;
}

interface Props {
  associationId: string;
  summary: FinanceSummaryResponse;
  transactions: {
    data: TransactionResponse[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  };
  categories: TransactionCategoryResponse[];
  monthlyStats: MonthlyStat[];
}

function getMonthDateRange(label: string) {
  const monthsTr = [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];
  const parts = label.split(' ');
  const year = Number(parts[parts.length - 1]);
  const monthName = parts.slice(0, -1).join(' ');
  const monthIndex = monthsTr.indexOf(monthName);
  if (monthIndex === -1) return null;

  const fromDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
  const toDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];
  return { fromDate, toDate };
}

export function FinanceDashboard({
  associationId,
  summary,
  transactions,
  categories,
  monthlyStats,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState<MonthlyStat | null>(null);
  const [monthTransactions, setMonthTransactions] = useState<TransactionResponse[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.02 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
    },
  };

  const latestTransactions = useMemo(() => transactions.data.slice(0, 6), [transactions.data]);

  async function handleMonthClick(month: MonthlyStat) {
    setSelectedMonth(month);
    setMonthLoading(true);
    try {
      const range = getMonthDateRange(month.label);
      if (!range) {
        setMonthTransactions([]);
        return;
      }
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMonthTransactions([]);
        return;
      }
      const result = await listTransactions(token, associationId, {
        fromDate: range.fromDate,
        toDate: range.toDate,
        page: 1,
        pageSize: 100,
      });
      setMonthTransactions(result.data);
    } catch {
      setMonthTransactions([]);
    } finally {
      setMonthLoading(false);
    }
  }

  const feeTotal = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.description?.startsWith('Aidat -'))
      .reduce((sum, tx) => sum + tx.amountInKurus, 0);
  }, [monthTransactions]);

  const expenseTotal = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce((sum, tx) => sum + tx.amountInKurus, 0);
  }, [monthTransactions]);

  const otherIncomeTotal = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'INCOME' && !tx.description?.startsWith('Aidat -'))
      .reduce((sum, tx) => sum + tx.amountInKurus, 0);
  }, [monthTransactions]);

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Compact Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Banknote className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">Finans Yönetimi</h1>
          <p className="text-[11px] text-muted-foreground">
            Telegram üzerinden kaydedilen tüm finansal hareketler ve kasa durumu.
          </p>
        </div>
      </motion.div>

      {/* Compact Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Kasa Bakiyesi</p>
                <p
                  className={`text-lg font-bold tabular-nums leading-tight ${
                    summary.balanceKurus >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {kurusToTl(summary.balanceKurus)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Aylık Gelir</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600 leading-tight">
                  {kurusToTl(summary.monthlyIncomeKurus)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-rose-500">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Aylık Gider</p>
                <p className="text-lg font-bold tabular-nums text-rose-600 leading-tight">
                  {kurusToTl(summary.monthlyExpenseKurus)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-100 text-rose-600">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Son İşlemler
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {transactions.meta.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Aylık Özet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-3">
            <Card>
              <CardContent className="p-0">
                {latestTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Receipt className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Henüz finansal işlem kaydedilmemiş.
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      İşlemler Telegram bot üzerinden otomatik olarak eklenecektir.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {latestTransactions.map((tx) => {
                      const cat = categories.find((c) => c.id === tx.categoryId);
                      const isIncome = tx.type === 'INCOME';
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                isIncome
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : 'bg-rose-100 text-rose-600'
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {tx.description || cat?.name || 'İşlem'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                {cat?.name && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-normal px-1 py-0"
                                  >
                                    {cat.name}
                                  </Badge>
                                )}
                                <span className="text-muted-foreground/40">•</span>
                                <span>
                                  {new Date(tx.transactionDate).toLocaleDateString('tr-TR', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-bold tabular-nums ml-2 ${
                              isIncome ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {kurusToTl(tx.amountInKurus)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-3">
            <Card>
              <CardContent className="p-0">
                {monthlyStats.length === 0 ||
                monthlyStats.every((m) => m.incomeKurus === 0 && m.expenseKurus === 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs font-medium text-muted-foreground">
                      Son 6 ayda finansal hareket bulunmuyor.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                    {monthlyStats.map((m) => {
                      const balance = m.incomeKurus - m.expenseKurus;
                      return (
                        <button
                          key={m.label}
                          onClick={() => handleMonthClick(m)}
                          className="relative flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all hover:bg-muted/50 hover:shadow-sm active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-muted-foreground" />
                              {m.label}
                            </span>
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {kurusToTl(balance)}
                            </span>
                          </div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            {m.incomeKurus > 0 && (
                              <div
                                className="bg-emerald-500"
                                style={{
                                  width: `${
                                    (m.incomeKurus / Math.max(m.incomeKurus + m.expenseKurus, 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            )}
                            {m.expenseKurus > 0 && (
                              <div
                                className="bg-rose-500"
                                style={{
                                  width: `${
                                    (m.expenseKurus / Math.max(m.incomeKurus + m.expenseKurus, 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-emerald-600 font-medium">
                              Gelir {kurusToTl(m.incomeKurus)}
                            </span>
                            <span className="text-rose-600 font-medium">
                              Gider {kurusToTl(m.expenseKurus)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Month Detail Dialog */}
      <Dialog open={!!selectedMonth} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedMonth?.label} Detayı
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bu aya ait tüm finansal hareketler.
            </DialogDescription>
          </DialogHeader>

          {monthLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary Chips */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-emerald-50 p-2 text-center">
                  <p className="text-[10px] text-emerald-700 font-medium">Aidat</p>
                  <p className="text-sm font-bold text-emerald-700 tabular-nums">
                    {kurusToTl(feeTotal)}
                  </p>
                </div>
                <div className="rounded-md bg-rose-50 p-2 text-center">
                  <p className="text-[10px] text-rose-700 font-medium">Gider</p>
                  <p className="text-sm font-bold text-rose-700 tabular-nums">
                    {kurusToTl(expenseTotal)}
                  </p>
                </div>
                <div className="rounded-md bg-blue-50 p-2 text-center">
                  <p className="text-[10px] text-blue-700 font-medium">Diğer Gelir</p>
                  <p className="text-sm font-bold text-blue-700 tabular-nums">
                    {kurusToTl(otherIncomeTotal)}
                  </p>
                </div>
              </div>

              {/* Transaction List */}
              {monthTransactions.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Bu ay için kayıtlı işlem bulunmuyor.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {monthTransactions.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    const isIncome = tx.type === 'INCOME';
                    const isFee = tx.description?.startsWith('Aidat -');
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-rose-100 text-rose-600'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {tx.description || cat?.name || 'İşlem'}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {cat?.name && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-normal px-1 py-0"
                                >
                                  {cat.name}
                                </Badge>
                              )}
                              {isFee && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] font-normal px-1 py-0"
                                >
                                  Aidat
                                </Badge>
                              )}
                              <span>
                                {new Date(tx.transactionDate).toLocaleDateString('tr-TR', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-bold tabular-nums ml-2 ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {kurusToTl(tx.amountInKurus)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
