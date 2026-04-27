import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { listAssociations } from '@/lib/api/associations';
import { EventsOverview } from './_components/events-overview';

export default async function EventsPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  let me;
  let associationsResponse;
  try {
    [me, associationsResponse] = await Promise.all([
      getMe(session.access_token),
      listAssociations(session.access_token, { pageSize: 100 }),
    ]);
  } catch {
    redirect('/associations');
  }

  const nameById = new Map(
    associationsResponse.data.map((a) => [a.id, a.name]),
  );

  const memberships = me.memberships
    .filter((m) => m.isActive)
    .map((m) => ({
      associationId: m.associationId,
      associationName: nameById.get(m.associationId) ?? 'Dernek',
      role: m.role,
    }));

  if (memberships.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Etkinlikler</h1>
          <p className="text-sm text-muted-foreground">
            Etkinlikleri görmek için önce bir derneğe üye olmanız gerekiyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <EventsOverview token={session.access_token} memberships={memberships} />
  );
}
