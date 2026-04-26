import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { AssociationForm } from '../_components/association-form';

export default async function NewAssociationPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  try {
    const me = await getMe(session.access_token);
    if (!isSystemAdmin(me)) redirect('/associations');
  } catch {
    redirect('/associations');
  }

  return <AssociationForm />;
}
