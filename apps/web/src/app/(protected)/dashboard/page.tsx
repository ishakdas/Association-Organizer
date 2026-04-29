import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { getGlobalBranchStats } from '@/lib/api/associations';
import {
  Building2,
  CheckCircle2,
  Clock,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { GlobalBranchStatsDto } from '@ticketbot/shared-types';

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
    // stats defaults korunur
  }

  const maxCityCount = stats.cityDistribution[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <span className="eyebrow">Yönetim Paneli</span>
        <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Genel Bakış
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tüm şubelerin güncel istatistikleri
        </p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Toplam Şube"
          value={stats.totalBranches}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          label="Aktif Şube"
          value={stats.activeBranches}
          valueClass="text-green-700 dark:text-green-400"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-muted-foreground" />}
          label="Pasif Şube"
          value={stats.inactiveBranches}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Toplam Üye"
          value={stats.totalMembers}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Bekleyen Başvuru"
          value={stats.pendingRegistrations}
          highlight={stats.pendingRegistrations > 0}
          action={
            stats.pendingRegistrations > 0
              ? { href: '/admin/pending-registrations', label: 'İncele' }
              : undefined
          }
        />
      </div>

      {/* City Distribution */}
      {stats.cityDistribution.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Şehir Dağılımı
          </h2>
          <div className="space-y-3">
            {stats.cityDistribution.map(({ city, count }) => (
              <div key={city} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[13px] font-medium text-foreground">
                  {city}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.round((count / maxCityCount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[12px] tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
  highlight,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClass?: string;
  highlight?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
        >
          {icon}
        </span>
        {action && (
          <Link
            href={action.href}
            className="text-[11px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div
        className={`mt-3 text-3xl font-bold tabular-nums tracking-tight ${valueClass ?? 'text-foreground'}`}
      >
        {value.toLocaleString('tr-TR')}
      </div>
      <div className="mt-1 text-[12.5px] text-muted-foreground">{label}</div>
    </div>
  );
}
