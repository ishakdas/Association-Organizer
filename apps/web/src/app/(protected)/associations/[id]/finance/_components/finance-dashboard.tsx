'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Download,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonthlyTrendChart } from './monthly-trend-chart';
import { CategoryChart } from './category-chart';
import { FeeTracking } from './fee-tracking';
import { TransactionsTable } from './transactions-table';
import { exportReportToExcel, exportToPDF } from './export-utils';
import { useTransactions, useFeePayments, useFinanceReport, useFinanceSettings } from '../../../_hooks/use-finance';
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
  report: Array<{
    categoryId: string;
    categoryName: string;
    type: 'INCOME' | 'EXPENSE';
    totalAmountKurus: number;
    transactionCount: number;
  }>;
}

export function FinanceDashboard({
  associationId,
  summary,
  transactions: initialTransactions,
  categories,
  monthlyStats,
  report: initialReport,
}: Props) {
  const [filters, setFilters] = useState<{
    type?: 'INCOME' | 'EXPENSE';
    categoryId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }>({});

  const { data: feePayments } = useFeePayments(associationId);
  const { data: settings } = useFinanceSettings(associationId);
  const { data: reportData } = useFinanceReport(
    associationId,
    filters.fromDate,
    filters.toDate,
  );

  const [page, setPage] = useState(1);
  const { data: transactionsData } = useTransactions(associationId, {
    page,
    pageSize: 20,
    ...filters,
  });

  const transactions = transactionsData || initialTransactions;
  const report = reportData || initialReport;

  const categoryChartData = useMemo(() => {
    if (!report) return [];
    return report.map((r) => ({
      name: r.categoryName,
      value: r.totalAmountKurus,
      type: r.type,
    }));
  }, [report]);

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

  const handleExportReport = () => {
    if (report) {
      exportReportToExcel(report, `finans-raporu-${new Date().toISOString().split('T')[0]}`);
    }
  };

  const handleExportPDF = async () => {
    await exportToPDF('finance-dashboard', `finans-raporu-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <motion.div
      id="finance-dashboard"
      className="mx-auto max-w-6xl space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">Finans Yönetimi</h1>
            <p className="text-[11px] text-muted-foreground">
              Derneğinizin tüm finansal verileri, raporları ve analizleri.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportReport} className="h-8 text-xs">
            <Download className="mr-1 h-3.5 w-3.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs">
            <Download className="mr-1 h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Toplam İşlem</p>
                <p className="text-lg font-bold tabular-nums text-blue-600 leading-tight">
                  {summary.totalIncomeKurus + summary.totalExpenseKurus > 0
                    ? Math.round((summary.totalIncomeKurus + summary.totalExpenseKurus) / 100).toLocaleString('tr-TR')
                    : '0'} <span className="text-[10px] font-normal text-muted-foreground">TL</span>
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                <Receipt className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <motion.div variants={itemVariants} className="grid gap-3 md:grid-cols-2">
        <MonthlyTrendChart data={monthlyStats} />
        <CategoryChart data={categoryChartData} type="INCOME" />
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-3 md:grid-cols-2">
        <CategoryChart data={categoryChartData} type="EXPENSE" />
        <FeeTracking
          feePayments={feePayments || []}
          monthlyFeeAmountKurus={settings?.monthlyFeeAmountKurus}
        />
      </motion.div>

      {/* Transactions Table */}
      <motion.div variants={itemVariants}>
        <TransactionsTable
          transactions={transactions.data}
          categories={categories}
          meta={transactions.meta}
          onPageChange={setPage}
          onFilterChange={setFilters}
          associationId={associationId}
        />
      </motion.div>
    </motion.div>
  );
}
