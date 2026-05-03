import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { getGlobalBranchStats } from '@/lib/api/associations';
import type { GlobalBranchStatsDto } from '@ticketbot/shared-types';
import { DashboardView } from './_components/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  try {
    const me = await getMe(session.access_token);
    if (!isSystemAdmin(me)) redirect('/associations');
  } catch {
    redirect('/associations');
  }

  let stats: GlobalBranchStatsDto = {
    totalBranches: 0,
    activeBranches: 0,
    inactiveBranches: 0,
    totalMembers: 0,
    pendingRegistrations: 0,
    cityDistribution: [],
  };

  try {
    stats = await getGlobalBranchStats(session.access_token);
  } catch {
    // defaults korunur
  }

  return <DashboardView stats={stats} />;
}
