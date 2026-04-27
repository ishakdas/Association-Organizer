import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createServerClient } from '@/lib/supabase/server';
import { getAssociation } from '@/lib/api/associations';
import { getMe } from '@/lib/api/me';
import { Button } from '@/components/ui/button';
import {
  canCreateTasksAndMeetings,
  canManageMembers,
  isSystemAdmin,
} from '@/lib/permissions';

import { DetailTabs } from '../_components/detail/detail-tabs';
import { GeneralSection } from '../_components/detail/general-section';
import { RosterSection } from '../_components/detail/roster-section';
import { TasksSection } from '../_components/detail/tasks-section';
import { MeetingsSection } from '../_components/detail/meetings-section';
import { TelegramSection } from '../_components/detail/telegram-section';
import { StatsPanel } from '../_components/detail/stats-panel';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}

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

    // Roster ekle/çıkar yalnızca başkan (+ SYSTEM_ADMIN) içindir.
    // Başkanı değiştirmek/görevden almak ise yalnızca SYSTEM_ADMIN'in
    // yetkisinde — başkan diğer başkanları yönetemez.
    // Görev ve toplantı notu oluşturma başkan + sekreter içindir.
    const canManageRoster = canManageMembers(me, id);
    const canManageManagerCard = isSystemAdmin(me);
    const canCreateWork = canCreateTasksAndMeetings(me, id);

    const showBack = isSystemAdmin(me);

    return (
      <div className="pb-10">
        <DetailHeader name={a.name} showBack={showBack} />

        {isSystemAdmin(me) && <div className="mt-6"><StatsPanel associationId={a.id} /></div>}

        <div className="mt-8">
          <DetailTabs
            defaultValue={section ?? 'genel'}
            genel={<GeneralSection a={a} />}
            baskan={
              <RosterSection
                associationId={a.id}
                role="ASSOCIATION_MANAGER"
                canManage={canManageManagerCard}
                variant="single"
              />
            }
            sekreterler={
              <RosterSection
                associationId={a.id}
                role="ASSOCIATION_SECRETARY"
                canManage={canManageRoster}
                variant="list"
              />
            }
            uyeler={
              <RosterSection
                associationId={a.id}
                role="ASSOCIATION_MEMBER"
                canManage={canManageRoster}
                variant="list"
              />
            }
            gorevler={
              <TasksSection associationId={a.id} canManage={canCreateWork} />
            }
            toplantilar={
              <MeetingsSection associationId={a.id} canManage={canCreateWork} />
            }
            telegram={
              <TelegramSection
                associationId={a.id}
                canManage={canManageRoster}
              />
            }
          />
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}

function DetailHeader({ name, showBack }: { name: string; showBack: boolean }) {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      {showBack && (
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
      )}
      {showBack && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/associations">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tüm derneklere dön
            </Link>
          </Button>
        </div>
      )}
      {!showBack && (
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
      )}
    </header>
  );
}
