import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import {
  getFinanceSummary,
  getMonthlyStats,
  getReport,
  listCategories,
  listTransactions,
} from '@/lib/api/finance';
import { getMe } from '@/lib/api/me';
import { canManageMembers } from '@/lib/permissions';
import { FinanceDashboard } from './_components/finance-dashboard';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FinancePage({ params }: Props) {
  const { id: associationId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return notFound();

  try {
    const [summary, transactions, categories, monthlyStats, report, me] = await Promise.all([
      getFinanceSummary(token, associationId),
      listTransactions(token, associationId, { page: 1, pageSize: 20 }),
      listCategories(token, associationId),
      getMonthlyStats(token, associationId),
      getReport(token, associationId),
      getMe(token).catch(() => null),
    ]);

    const canManage = canManageMembers(me, associationId);

    return (
      <FinanceDashboard
        associationId={associationId}
        summary={summary}
        transactions={transactions}
        categories={categories}
        monthlyStats={monthlyStats}
        report={report}
        canManageCategories={canManage}
      />
    );
  } catch {
    return notFound();
  }
}
