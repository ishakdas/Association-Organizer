'use client';

import { BarChart3, CheckCircle2, ClipboardList, Users } from 'lucide-react';
import { useAssociationStats } from '../../_hooks/use-association-stats';

const ROLE_LABELS: Record<string, string> = {
  ASSOCIATION_MANAGER: 'Başkan',
  ASSOCIATION_SECRETARY: 'Sekreter',
  ASSOCIATION_MEMBER: 'Üye',
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
};

export function StatsPanel({ associationId }: { associationId: string }) {
  const { data, isLoading, isError } = useAssociationStats(associationId);

  if (isLoading) {
    return (
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
        ))}
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Toplam Üye"
          value={String(data.totalMembers)}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Toplam Görev"
          value={String(data.totalTasks)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tamamlama Oranı"
          value={`%${data.completionRate}`}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Toplantı Sayısı"
          value={String(data.totalMeetings)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          Üye Dağılımı
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.membersByRole).map(([role, count]) => (
            <span
              key={role}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-[12px] font-medium"
            >
              {ROLE_LABELS[role] ?? role}
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                {count}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Görev tamamlama</span>
            <span className="font-medium text-foreground">
              {data.completedTasks}/{data.totalTasks}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.completionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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
