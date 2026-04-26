import { notFound } from 'next/navigation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import type { TitleResponse } from '@ticketbot/shared-validation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { listAdminTitles } from '@/lib/api/titles';
import { isSystemAdmin } from '@/lib/permissions';
import { TitlesManager } from '../../admin/member-titles/_components/titles-manager';

export const metadata = { title: 'Üye Unvanları' };

export default async function SettingsTitlesPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) notFound();

  let me: AuthenticatedUser;
  try {
    me = await getMe(session.access_token);
  } catch {
    notFound();
  }

  if (!isSystemAdmin(me)) notFound();

  let initialData: TitleResponse[] = [];
  try {
    initialData = await listAdminTitles(session.access_token);
  } catch {
    initialData = [];
  }

  return <TitlesManager initialData={initialData} />;
}
