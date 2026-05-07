import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getFinanceSummary, listCategories, getMonthlyStats } from '@/lib/api/finance';
import { FinanceDashboard } from './_components/finance-dashboard';

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
    const [summary, transactions, categories, monthlyStats] = await Promise.all([
      getFinanceSummary(token, associationId),
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/associations/${associationId}/finance/transactions?page=1&pageSize=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then((r) => (r.ok ? r.json() : { data: [], meta: { total: 0 } })),
      listCategories(token, associationId),
      getMonthlyStats(token, associationId),
    ]);

    return (
      <FinanceDashboard
        associationId={associationId}
        summary={summary}
        transactions={transactions}
        categories={categories}
        monthlyStats={monthlyStats}
      />
    );
  } catch {
    return notFound();
  }
}
