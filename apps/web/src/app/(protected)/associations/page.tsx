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

  let initialData = EMPTY;
  let canCreate = false;
  if (session) {
    try {
      const me = await getMe(session.access_token);
      canCreate = isSystemAdmin(me);

      // Non-admin users with a single active membership go directly to that association
      if (!isSystemAdmin(me)) {
        const active = activeMemberships(me);
        if (active.length === 1) {
          redirect(`/associations/${active[0].associationId}`);
        }
      }
    } catch {
      canCreate = false;
    }

    try {
      initialData = await listAssociations(session.access_token, {
        page: 1,
        pageSize: 20,
      });
    } catch {
      initialData = EMPTY;
    }
  }

  return <AssociationsList initialData={initialData} canCreate={canCreate} />;
}
