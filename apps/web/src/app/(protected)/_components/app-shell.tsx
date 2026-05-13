'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BookOpen,
  BookUser,
  Calendar,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  UserCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isSystemAdmin, activeMemberships, userRoleLabel } from '@/lib/permissions';
import { usePendingRegistrationsCount } from '../admin/pending-registrations/_hooks/use-pending-count';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  badge?: number;
  matchSection?: string;
}

function buildNav(user: AuthenticatedUser): NavItem[] {
  if (isSystemAdmin(user)) {
    return [
      { href: '/dashboard', label: 'Ana Sayfa', icon: Home, primary: true },
      { href: '/associations', label: 'Şubeler', icon: BookUser, primary: true },
      { href: '/admin/pending-registrations', label: 'Başvurular', icon: UserCheck, primary: true },
      { href: '/settings', label: 'Ayarlar', icon: Settings },
    ];
  }

  const active = activeMemberships(user);
  if (active.length === 0) {
    return [{ href: '/settings', label: 'Ayarlar', icon: Settings }];
  }

  const assocId = active[0].associationId;
  const base = `/associations/${assocId}`;

  return [
    { href: `${base}?section=dashboard`, label: 'Dashboard', icon: LayoutDashboard, primary: true, matchSection: 'dashboard' },
    { href: `${base}?section=uyeler`, label: 'Üyeler', icon: Users, primary: true, matchSection: 'uyeler' },
    { href: `${base}?section=gorevler`, label: 'Görevler', icon: ClipboardList, primary: true, matchSection: 'gorevler' },
    { href: `${base}?section=toplantilar`, label: 'Toplantılar', icon: BookOpen, matchSection: 'toplantilar' },
    { href: `${base}/finance`, label: 'Finans', icon: Wallet },
    { href: '/events', label: 'Etkinlikler', icon: Calendar, primary: true },
    { href: `${base}?section=telegram`, label: 'Telegram', icon: MessageSquare, matchSection: 'telegram' },
    { href: '/settings', label: 'Ayarlar', icon: Settings },
  ];
}

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // Always call the hook (React rules), but skip the network call for non-admins
  const pendingCount = usePendingRegistrationsCount(isSystemAdmin(user));
  const items = buildNav(user).map((item) =>
    item.href === '/admin/pending-registrations' && pendingCount > 0
      ? { ...item, badge: pendingCount }
      : item,
  );

  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/^\/associations\/([^/]+)/);
    if (match?.[1]) {
      localStorage.setItem('lastAssociationId', match[1]);
    }
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        user={user}
        items={items}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar onMenu={() => setMobileOpen(true)} />
        {user.mustChangePassword && user.onboardingCompletedAt && (
          <TempPasswordBanner />
        )}
        <main className="flex-1 px-5 pb-10 pt-6 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  user,
  items,
  mobileOpen,
  onClose,
}: {
  user: AuthenticatedUser;
  items: NavItem[];
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const brandHref = (() => {
    if (isSystemAdmin(user)) return '/dashboard';
    const active = activeMemberships(user);
    if (active.length === 1) return `/associations/${active[0].associationId}`;
    return '/associations';
  })();

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border bg-card shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <Brand homeHref={brandHref} />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <span className="eyebrow px-2">Çalışma alanı</span>
        </div>

        <nav
          aria-label="Birincil"
          className="flex-1 space-y-0.5 overflow-y-auto px-3"
        >
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              active={isNavActive(pathname, searchParams, item)}
              onClick={onClose}
            />
          ))}
        </nav>

        <UserFooter user={user} />
      </aside>
    </>
  );
}

function Brand({ homeHref = '/associations' }: { homeHref?: string }) {
  return (
    <Link href={homeHref} className="group flex items-center gap-3">
      <Image
        src="/yedihilal-logo.png"
        alt="YediHilal"
        width={32}
        height={45}
        className="h-11 w-auto"
        priority
      />
      <div className="leading-tight">
        <div className="text-[13px] font-bold tracking-tight text-foreground">
          Dernek Organizer
        </div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Sicil &amp; Üyelik
        </div>
      </div>
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-0.5',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors duration-150',
          active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      <span className="truncate flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
          {badge}
        </span>
      )}
    </Link>
  );
}

function UserFooter({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const display = user.fullName || user.email || '';
  const initials = (user.fullName || user.email || '??')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const role = userRoleLabel(user) ?? 'Üye';

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-foreground">
            {display}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {role}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-1 w-full justify-start text-muted-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        {signingOut ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
      </Button>
    </div>
  );
}

function MobileTopbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
      <Brand homeHref="/associations" />
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Menüyü aç"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}


function isNavActive(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>,
  item: NavItem,
): boolean {
  if (!pathname) return false;

  // Section-based nav items (branch sidebar links)
  if (item.matchSection) {
    const section = searchParams.get('section');
    const itemPathname = item.href.split('?')[0];
    if (!pathname || pathname !== itemPathname) return false;
    // Dashboard is active when no section param or section=dashboard
    if (item.matchSection === 'dashboard') {
      return !section || section === 'dashboard';
    }
    return section === item.matchSection;
  }

  // /dashboard — exact match
  if (item.href === '/dashboard') {
    return pathname === '/dashboard';
  }

  // /associations — exact match only for the admin nav item
  if (item.href === '/associations') {
    return pathname === '/associations';
  }

  if (item.href === '/admin/pending-registrations') {
    return pathname.startsWith('/admin/');
  }

  if (item.href === '/settings') {
    return pathname.startsWith('/settings');
  }

  return pathname === item.href;
}

function TempPasswordBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-[13px] font-medium">
        Davet bağlantısı ile giriş yaptınız. Güvenliğiniz için kalıcı bir şifre belirlemenizi öneririz.
      </p>
      <a
        href="/settings/profile"
        className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
      >
        Şimdi Değiştir
      </a>
    </div>
  );
}
