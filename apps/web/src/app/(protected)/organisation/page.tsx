import { createServerClient } from '@/lib/supabase/server';
import { getMyOrganisations, type MembershipWithOrganisation } from '@/lib/api/organisations';
import { OrganisationsView } from './_components/organisations-view';

export default async function OrganisationPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let initialData: MembershipWithOrganisation[] = [];
  if (session) {
    try {
      initialData = await getMyOrganisations(session.access_token);
    } catch {
      // First login before user is auto-provisioned, or API unreachable.
      // Client side will retry via TanStack Query.
      initialData = [];
    }
  }

  return <OrganisationsView initialData={initialData} />;
}
