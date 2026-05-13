import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { listAssociations } from '@/lib/api/associations';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin, activeMemberships } from '@/lib/permissions';
import type { AssociationListResponse } from '@ticketbot/shared-types';
import { AssociationsList } from './_components/associations-list';

const EMPTY: AssociationListResponse = {
  data: [],
  meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 },
};

export default async function AssociationsPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Resolve current user first. `redirect()` throws NEXT_REDIRECT internally,
  // so it MUST NOT be wrapped in a try/catch — otherwise the navigation
  // signal is swallowed and the picker renders even when it shouldn't.
  const me = session ? await safeGetMe(session.access_token) : null;

  if (me && !isSystemAdmin(me)) {
    // System admins always see the full branch list. Non-admins with a
    // single active membership go straight to that branch (no picker).
    const active = activeMemberships(me);
    if (active.length === 1) {
      redirect(`/associations/${active[0].associationId}`);
    }
  }

  let initialData = EMPTY;
  if (session) {
    try {
      initialData = await listAssociations(session.access_token, {
        page: 1,
        pageSize: 20,
      });
    } catch {
      initialData = EMPTY;
    }
  }

  return <AssociationsList initialData={initialData} />;
}

async function safeGetMe(token: string) {
  try {
    return await getMe(token);
  } catch {
    return null;
  }
}
