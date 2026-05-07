'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '../../_hooks/use-associations';
import { getFinanceSummary, listCategories, getMonthlyStats, getReport } from '@/lib/api/finance';
import { FinanceDashboard } from '../../[id]/finance/_components/finance-dashboard';
import type { TransactionResponse } from '@ticketbot/shared-validation';

interface FinanceData {
  summary: Awaited<ReturnType<typeof getFinanceSummary>>;
  transactions: { data: TransactionResponse[]; meta: { total: number; page: number; pageSize: number; totalPages: number } };
  categories: Awaited<ReturnType<typeof listCategories>>;
  monthlyStats: Awaited<ReturnType<typeof getMonthlyStats>>;
  report: Awaited<ReturnType<typeof getReport>>;
}

export function FinanceSection({ associationId }: { associationId: string }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        const [summary, transactions, categories, monthlyStats, report] = await Promise.all([
          getFinanceSummary(token, associationId),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/associations/${associationId}/finance/transactions?page=1&pageSize=20`,
            { headers: { Authorization: `Bearer ${token}` } },
          ).then((r) => (r.ok ? r.json() : { data: [], meta: { total: 0 } })),
          listCategories(token, associationId),
          getMonthlyStats(token, associationId),
          getReport(token, associationId),
        ]);

        setData({ summary, transactions, categories, monthlyStats, report });
      } catch (err) {
        console.error('Failed to load finance data:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [associationId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Finans verileri yüklenemedi.</p>
      </div>
    );
  }

  return (
      <FinanceDashboard
        associationId={associationId}
        summary={data.summary}
        transactions={data.transactions}
        categories={data.categories}
        monthlyStats={data.monthlyStats}
        report={data.report}
      />
  );
}
