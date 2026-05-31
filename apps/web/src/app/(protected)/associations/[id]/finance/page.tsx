import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getFinanceSummary, listCategories, getMonthlyStats, getReport } from '@/lib/api/finance';
import { getMe } from '@/lib/api/me';
import { canManageMembers } from '@/lib/permissions';
import { FinanceDashboard } from './_components/finance-dashboard';
import { DonationCategoryManager } from './_components/donation-category-manager';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FinancePage({ params }: Props) {
  const { id: associationId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return notFound();

  try {
    const [summary, transactions, categories, monthlyStats, report, me] = await Promise.all([
      getFinanceSummary(token, associationId),
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/associations/${associationId}/finance/transactions?page=1&pageSize=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then((r) => (r.ok ? r.json() : { data: [], meta: { total: 0 } })),
      listCategories(token, associationId),
      getMonthlyStats(token, associationId),
      getReport(token, associationId),
      getMe(token).catch(() => null),
    ]);

    const canManage = canManageMembers(me, associationId);

    return (
      <div className="space-y-8">
        <FinanceDashboard
          associationId={associationId}
          summary={summary}
          transactions={transactions}
          categories={categories}
          monthlyStats={monthlyStats}
          report={report}
        />
        <DonationCategoryManager
          associationId={associationId}
          canManage={canManage}
        />
      </div>
    );
  } catch {
    return notFound();
  }
}
