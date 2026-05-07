'use client';

import { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Banknote,
  BarChart3,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  FinanceSummaryResponse,
  TransactionResponse,
  TransactionCategoryResponse,
} from '@ticketbot/shared-validation';

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

function useCountUp(target: number, duration = 1.2) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, target, {
      duration,
      ease: 'easeOut',
    });
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [target, duration]);

  return display;
}

function AnimatedAmount({ valueInKurus }: { valueInKurus: number }) {
  const animated = useCountUp(Math.abs(valueInKurus));
  return <span>{kurusToTl(animated)}</span>;
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

export function FinanceDashboard({
  associationId: _associationId,
  summary,
  transactions,
  categories,
  monthlyStats,
}: Props) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
    },
  };

  const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: 0.4 + i * 0.05,
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    }),
  };

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Banknote className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Finans Yönetimi</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-[52px]">
          Telegram üzerinden kaydedilen tüm finansal hareketler ve kasa durumu.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-l-4 border-l-primary transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Kasa Bakiyesi
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold tracking-tight ${
                  summary.balanceKurus >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <AnimatedAmount valueInKurus={summary.balanceKurus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Güncel toplam bakiye
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aylık Gelir
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-emerald-600">
                <AnimatedAmount valueInKurus={summary.monthlyIncomeKurus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu ayki toplam gelir
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-l-4 border-l-rose-500 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aylık Gider
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-rose-600">
                <AnimatedAmount valueInKurus={summary.monthlyExpenseKurus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu ayki toplam gider
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transactions */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-5 w-5 text-primary" />
              Son İşlemler
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {transactions.meta.total} kayıt
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.data.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Henüz finansal işlem kaydedilmemiş.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs">
                  İşlemler Telegram bot üzerinden otomatik olarak eklenecektir.
                </p>
              </motion.div>
            ) : (
              <div className="divide-y">
                {transactions.data.map((tx, index) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  const isIncome = tx.type === 'INCOME';

                  return (
                    <motion.div
                      key={tx.id}
                      custom={index}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-rose-100 text-rose-600'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {tx.description || cat?.name || 'İşlem'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {cat?.name && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal"
                              >
                                {cat.name}
                              </Badge>
                            )}
                            <span className="text-muted-foreground/50">•</span>
                            <span>
                              {new Date(tx.transactionDate).toLocaleDateString(
                                'tr-TR',
                                {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {kurusToTl(tx.amountInKurus)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Monthly Stats */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Aylık Özet (Son 6 Ay)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {monthlyStats.length === 0 || monthlyStats.every((m) => m.incomeKurus === 0 && m.expenseKurus === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Son 6 ayda finansal hareket bulunmuyor.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {monthlyStats.map((m) => {
                  const balance = m.incomeKurus - m.expenseKurus;
                  const maxVal = Math.max(m.incomeKurus, m.expenseKurus, 1);
                  const incomePct = (m.incomeKurus / maxVal) * 100;
                  const expensePct = (m.expenseKurus / maxVal) * 100;

                  return (
                    <div
                      key={m.label}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-medium">{m.label}</p>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          {incomePct > 0 && (
                            <div
                              className="bg-emerald-500"
                              style={{ width: `${incomePct}%` }}
                            />
                          )}
                          {expensePct > 0 && (
                            <div
                              className="bg-rose-500"
                              style={{ width: `${expensePct}%` }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="text-emerald-600">
                            🟢 Gelir {kurusToTl(m.incomeKurus)}
                          </span>
                          <span className="text-rose-600">
                            🔴 Gider {kurusToTl(m.expenseKurus)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`ml-4 shrink-0 text-sm font-bold tabular-nums ${
                          balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {kurusToTl(balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
