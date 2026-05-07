import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createServerClient } from '@/lib/supabase/server';
import { getAssociation } from '@/lib/api/associations';
import { getMe } from '@/lib/api/me';
import { canCreateTasksAndMeetings, canManageMembers, isSystemAdmin } from '@/lib/permissions';

import { DetailTabs } from '../_components/detail/detail-tabs';
import { GeneralSection } from '../_components/detail/general-section';
import { DashboardSection } from '../_components/detail/dashboard-section';
import { RosterSection } from '../_components/detail/roster-section';
import { TasksSection } from '../_components/detail/tasks-section';
import { MeetingsSection } from '../_components/detail/meetings-section';
import { TelegramSection } from '../_components/detail/telegram-section';
import { FinanceSection } from '../_components/detail/finance-section';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}

const VALID_SECTIONS = ['dashboard', 'finans', 'uyeler', 'gorevler', 'toplantilar', 'telegram', 'ayarlar'] as const;
type Section = (typeof VALID_SECTIONS)[number];

export default async function AssociationDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { section } = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) notFound();

  let me: AuthenticatedUser | null = null;
  try {
    me = await getMe(session.access_token);
  } catch {
    me = null;
  }

  try {
    const a = await getAssociation(session.access_token, id);

    const canManageRoster = canManageMembers(me, id);
    const canManageManagerCard = isSystemAdmin(me);
    const canCreateWork = canCreateTasksAndMeetings(me, id);

    // Admin: tab-based navigation (sidebar doesn't have association sections)
    if (isSystemAdmin(me)) {
      return (
        <div className="pb-10">
          <AdminDetailHeader name={a.name} />
          <div className="mt-8">
            <DetailTabs
              defaultValue={section ?? 'dashboard'}
              dashboard={<DashboardSection associationId={a.id} />}
              finans={<FinanceSection associationId={a.id} />}
              ayarlar={<GeneralSection a={a} />}
              uyeler={
                <RosterSection
                  associationId={a.id}
                  canManage={canManageRoster}
                  canManageManager={canManageManagerCard}
                />
              }
              gorevler={<TasksSection associationId={a.id} canManage={canCreateWork} currentUserId={me?.id} />}
              toplantilar={<MeetingsSection associationId={a.id} canManage={canCreateWork} />}
              telegram={<TelegramSection associationId={a.id} canManage={canManageRoster} />}
            />
          </div>
        </div>
      );
    }

    // Member: sidebar handles navigation, no tabs inside the page
    const activeSection: Section = VALID_SECTIONS.includes(section as Section)
      ? (section as Section)
      : 'dashboard';

    return (
      <div className="pb-10">
        <MemberDetailHeader name={a.name} />
        <div className="mt-8">
          {activeSection === 'dashboard' && <DashboardSection associationId={a.id} />}
          {activeSection === 'finans' && <FinanceSection associationId={a.id} />}
          {activeSection === 'uyeler' && (
            <RosterSection
              associationId={a.id}
              canManage={canManageRoster}
              canManageManager={canManageManagerCard}
            />
          )}
          {activeSection === 'gorevler' && (
            <TasksSection associationId={a.id} canManage={canCreateWork} currentUserId={me?.id} />
          )}
          {activeSection === 'toplantilar' && (
            <MeetingsSection associationId={a.id} canManage={canCreateWork} />
          )}
          {activeSection === 'telegram' && (
            <TelegramSection associationId={a.id} canManage={canManageRoster} />
          )}
          {activeSection === 'ayarlar' && <GeneralSection a={a} />}
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}

function AdminDetailHeader({ name }: { name: string }) {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-[12px] text-muted-foreground"
      >
        <Link
          href="/associations"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Dernek Sicili
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="truncate font-medium text-foreground">{name}</span>
      </nav>
      <div className="flex items-center gap-4">
        <Link
          href="/associations"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          ← Tüm derneklere dön
        </Link>
      </div>
    </header>
  );
}

function MemberDetailHeader({ name }: { name: string }) {
  return (
    <header className="border-b border-border pb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
    </header>
  );
}
