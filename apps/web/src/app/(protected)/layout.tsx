import { redirect } from 'next/navigation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { AppShell } from './_components/app-shell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/login');
  }

  let me: AuthenticatedUser;
  try {
    me = await getMe(session.access_token);
  } catch {
    // Fail open with an empty-membership stub so the layout still renders
    // (e.g. on first login before the API has provisioned the user row).
    me = {
      id: session.user.id,
      email: session.user.email ?? null,
      fullName: session.user.email ?? '',
      supabaseUserId: session.user.id,
      memberships: [],
      systemRole: null,
    };
  }

  return <AppShell user={me}>{children}</AppShell>;
}
