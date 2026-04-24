import { notFound } from 'next/navigation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import type { TitleResponse } from '@ticketbot/shared-validation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { listAdminTitles } from '@/lib/api/titles';
import { isSystemAdmin } from '@/lib/permissions';
import { TitlesManager } from './_components/titles-manager';

export const metadata = {
  title: 'Unvan Yönetimi',
};

export default async function AdminMemberTitlesPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // (protected)/layout already enforces an authenticated session — a
  // missing one here is an edge-case race, so bounce to 404 rather than
  // redirect-loop.
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
    // Leave empty; the client hook will retry with the user's token.
    initialData = [];
  }

  return <TitlesManager initialData={initialData} />;
}
