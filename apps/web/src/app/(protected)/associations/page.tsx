import { createServerClient } from '@/lib/supabase/server';
import { listAssociations } from '@/lib/api/associations';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
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
      initialData = await listAssociations(session.access_token, {
        page: 1,
        pageSize: 20,
      });
    } catch {
      // Auto-provisioning may not have completed yet, or API unreachable.
      // Client side will refetch via TanStack Query.
      initialData = EMPTY;
    }
    try {
      const me = await getMe(session.access_token);
      canCreate = isSystemAdmin(me);
    } catch {
      canCreate = false;
    }
  }

  return <AssociationsList initialData={initialData} canCreate={canCreate} />;
}
