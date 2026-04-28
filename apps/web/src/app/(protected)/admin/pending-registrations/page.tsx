import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { listPendingRegistrations, type PendingRegistration } from '@/lib/api/auth';
import { PendingRegistrationsList } from './_components/pending-registrations-list';

export const dynamic = 'force-dynamic';

export default async function PendingRegistrationsPage() {
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

  let initialData: PendingRegistration[] = [];
  try {
    initialData = await listPendingRegistrations(session.access_token);
  } catch {
    initialData = [];
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Şube Başvuruları</h1>
        <p className="text-sm text-muted-foreground">
          Bekleyen şube kayıt başvurularını inceleyin ve onaylayın.
        </p>
      </div>

      <PendingRegistrationsList initialData={initialData} />
    </div>
  );
}
