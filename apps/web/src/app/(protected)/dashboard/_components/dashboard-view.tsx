'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, Users, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { GlobalBranchStatsDto } from '@ticketbot/shared-types';
import { Button } from '@/components/ui/button';

function useAnimatedNumber(target: number, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) { setValue(0); return; }
    const t = setTimeout(() => {
      const duration = 1000;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
        else setValue(target);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return value;
}

function useMounted(delay = 0) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return mounted;
}

function useBarWidth(target: number, delay = 0) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(target), delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return width;
}

function RingChart({ active, total }: { active: number; total: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const pct = total ? active / total : 0;
  const [arc, setArc] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setArc(pct * circumference), 300);
    return () => clearTimeout(t);
  }, [pct, circumference]);

  const displayPct = total ? Math.round((active / total) * 100) : 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke="hsl(var(--muted))" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="10"
          stroke="#22c55e"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold tabular-nums leading-none text-foreground">{displayPct}%</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Aktif</div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  delay?: number;
  iconClass?: string;
  highlight?: boolean;
  action?: { href: string; label: string };
}

function StatCard({ icon, label, value, delay = 0, iconClass, highlight, action }: StatCardProps) {
  const animated = useAnimatedNumber(value, delay);
  const visible = useMounted(delay);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-md ${
        highlight
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'border-border bg-card'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={iconClass ?? 'text-muted-foreground'}>{icon}</span>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
          >
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div
        className={`mt-3 text-3xl font-bold tabular-nums tracking-tight ${
          highlight ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'
        }`}
      >
        {animated.toLocaleString('tr-TR')}
      </div>
      <div className="mt-1 text-[12.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CityBar({ city, count, max, delay }: { city: string; count: number; max: number; delay: number }) {
  const pct = Math.round((count / max) * 100);
  const width = useBarWidth(pct, 300 + delay);

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-[13px] font-medium text-foreground">{city}</span>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${width}%`, transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </div>
        <span className="w-8 text-right text-[12px] tabular-nums text-muted-foreground">{count}</span>
      </div>
    </div>
  );
}

export function DashboardView({ stats }: { stats: GlobalBranchStatsDto }) {
  const maxCityCount = stats.cityDistribution[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <span className="eyebrow">Yönetim Paneli</span>
        <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Genel Bakış
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Tüm şubelerin güncel istatistikleri</p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Toplam Şube"
          value={stats.totalBranches}
          delay={0}
          iconClass="text-primary"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Aktif Şube"
          value={stats.activeBranches}
          delay={80}
          iconClass="text-green-600"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="Pasif Şube"
          value={stats.inactiveBranches}
          delay={160}
          iconClass="text-muted-foreground"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Toplam Üye"
          value={stats.totalMembers}
          delay={240}
          iconClass="text-blue-600"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Bekleyen Başvuru"
          value={stats.pendingRegistrations}
          delay={320}
          highlight={stats.pendingRegistrations > 0}
          action={
            stats.pendingRegistrations > 0
              ? { href: '/admin/pending-registrations', label: 'İncele' }
              : undefined
          }
        />
      </div>

      {/* Visual Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Donut Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Şube Durumu
          </h2>
          <div className="flex items-center gap-8">
            <RingChart active={stats.activeBranches} total={stats.totalBranches} />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-foreground font-medium">{stats.activeBranches} Aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                <span className="text-sm text-foreground font-medium">{stats.inactiveBranches} Pasif</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/associations">Tüm Şubeler</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Üye Özeti */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hızlı Özet
          </h2>
          <div className="space-y-5">
            <ActiveRatioBar
              label="Aktif Şube Oranı"
              value={stats.activeBranches}
              total={stats.totalBranches}
              color="bg-green-500"
              delay={500}
            />
            <ActiveRatioBar
              label="Üye / Şube Ortalaması"
              value={stats.totalBranches > 0 ? Math.round(stats.totalMembers / stats.totalBranches) : 0}
              total={stats.totalBranches > 0 ? Math.round(stats.totalMembers / stats.totalBranches) : 1}
              color="bg-blue-500"
              delay={700}
              showRaw
              rawValue={
                stats.totalBranches > 0
                  ? `${Math.round(stats.totalMembers / stats.totalBranches)} kişi`
                  : '—'
              }
            />
            {stats.pendingRegistrations > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                  {stats.pendingRegistrations} bekleyen başvuru var
                </p>
                <Link
                  href="/admin/pending-registrations"
                  className="mt-0.5 inline-block text-[12px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  Başvuruları İncele →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* City Distribution */}
      {stats.cityDistribution.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Şehir Dağılımı
          </h2>
          <div className="space-y-3">
            {stats.cityDistribution.map(({ city, count }, i) => (
              <CityBar key={city} city={city} count={count} max={maxCityCount} delay={i * 50} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActiveRatioBar({
  label,
  value,
  total,
  color,
  delay,
  showRaw,
  rawValue,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  delay: number;
  showRaw?: boolean;
  rawValue?: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const width = useBarWidth(pct, delay);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {showRaw ? rawValue : `${pct}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${width}%`, transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </div>
    </div>
  );
}
