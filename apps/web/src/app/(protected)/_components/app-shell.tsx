'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookUser,
  LogOut,
  Menu,
  Settings,
  Tags,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  filterNav,
  userRoleLabel,
  type NavItemDef,
} from '@/lib/permissions';

interface NavMeta {
  label: string;
  icon: LucideIcon;
  /** When true, also surfaced in the mobile bottom nav (max 4). */
  primary?: boolean;
}
type NavItem = NavItemDef<NavMeta>;

const NAV: readonly NavItem[] = [
  {
    href: '/associations',
    access: 'auth',
    meta: { label: 'Dernek Sicili', icon: BookUser, primary: true },
  },
  {
    href: '/admin/member-titles',
    access: 'system_admin',
    meta: { label: 'Unvanlar', icon: Tags },
  },
  {
    href: '/settings/telegram',
    access: 'auth',
    meta: { label: 'Ayarlar', icon: Settings, primary: true },
  },
];

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = filterNav(NAV, user);
  const primary = items.filter((i) => i.meta?.primary).slice(0, 4);

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
        <main className="flex-1 px-5 pb-24 pt-6 sm:px-8 sm:py-10 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <BottomNav items={primary} />
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

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <Brand />
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
              label={item.meta!.label}
              icon={item.meta!.icon}
              active={isActive(pathname, item.href)}
              onClick={onClose}
            />
          ))}
        </nav>

        <UserFooter user={user} />
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/associations" className="group flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
        <span className="text-[13px] font-extrabold tracking-tight">DO</span>
      </div>
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
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <span className="truncate">{label}</span>
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
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
      <Brand />
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

function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Mobil birincil gezinme"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const Icon = item.meta!.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{item.meta!.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/associations') {
    return pathname === '/associations' || pathname.startsWith('/associations/');
  }
  if (href === '/settings/telegram') {
    return pathname.startsWith('/settings');
  }
  if (href === '/admin/member-titles') {
    return pathname.startsWith('/admin/member-titles');
  }
  return pathname === href;
}
