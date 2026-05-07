'use client';

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import type { AssociationStatsDto } from '@ticketbot/shared-types';
import { useAssociationStats } from '../../_hooks/use-association-stats';

const ROLE_LABELS: Record<string, string> = {
  ASSOCIATION_MANAGER: 'Başkan',
  ASSOCIATION_SECRETARY: 'Sekreter',
  ASSOCIATION_MEMBER: 'Üye',
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
};

export function DashboardSection({ associationId }: { associationId: string }) {
  const { data, isLoading, isError } = useAssociationStats(associationId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-xl border border-border bg-muted" />
          <div className="h-48 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <div className="space-y-6">
      <StatCards data={data} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Son 6 Ay — Görevler"
          icon={<ClipboardList className="h-4 w-4" />}
          data={data.tasksByMonth}
          color="bg-primary"
        />
        <BarChartCard
          title="Son 6 Ay — Toplantılar"
          icon={<BookOpen className="h-4 w-4" />}
          data={data.meetingsByMonth}
          color="bg-emerald-500"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskStatusCard data={data} />
        <MemberBreakdownCard data={data} />
      </div>
      <FinanceLinkCard associationId={associationId} />
    </div>
  );
}

function StatCards({ data }: { data: AssociationStatsDto }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Toplam Üye"
        value={data.totalMembers}
      />
      <StatCard
        icon={<ClipboardList className="h-5 w-5" />}
        label="Toplam Görev"
        value={data.totalTasks}
      />
      <StatCard
        icon={<CheckCircle2 className="h-5 w-5" />}
        label="Tamamlama"
        value={`%${data.completionRate}`}
      />
      <StatCard
        icon={<BarChart3 className="h-5 w-5" />}
        label="Toplantı"
        value={data.totalMeetings}
      />
    </div>
  );
}

function FinanceLinkCard({ associationId }: { associationId: string }) {
  return (
    <Link href={`/associations/${associationId}/finance`}>
      <div className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Finans Yönetimi</p>
          <p className="text-xs text-muted-foreground">
            Gelir, gider ve kasa durumu takibi
          </p>
        </div>
      </div>
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function BarChartCard({
  title,
  icon,
  data,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  data: { month: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[12px] font-semibold uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex h-32 items-end gap-2">
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
              {d.count > 0 ? d.count : ''}
            </span>
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '2px' }}>
              <div
                className={`h-full w-full rounded-t-sm ${d.count > 0 ? color : 'bg-muted'} transition-all`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStatusCard({ data }: { data: AssociationStatsDto }) {
  const statuses = [
    { label: 'Bekliyor', count: data.pendingTasks, color: 'bg-amber-400' },
    { label: 'Devam Ediyor', count: data.inProgressTasks ?? 0, color: 'bg-blue-500' },
    { label: 'Tamamlandı', count: data.completedTasks, color: 'bg-emerald-500' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-[12px] font-semibold uppercase tracking-widest">Görev Durumu</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted flex">
        {data.totalTasks > 0 &&
          statuses.map((s) => (
            <div
              key={s.label}
              className={`${s.color} h-full transition-all`}
              style={{ width: `${(s.count / data.totalTasks) * 100}%` }}
            />
          ))}
      </div>
      <div className="space-y-2">
        {statuses.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
            <span className="font-semibold tabular-nums text-foreground">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberBreakdownCard({ data }: { data: AssociationStatsDto }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="text-[12px] font-semibold uppercase tracking-widest">Üye Dağılımı</span>
      </div>
      <div className="space-y-3">
        {Object.entries(data.membersByRole).map(([role, count]) => {
          const pct = data.totalMembers > 0 ? (count / data.totalMembers) * 100 : 0;
          return (
            <div key={role} className="space-y-1">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>
                <span className="font-semibold tabular-nums text-foreground">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
