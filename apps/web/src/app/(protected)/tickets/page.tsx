import { createServerClient } from '../../../lib/supabase/server';
import { getTickets } from '../../../lib/api/tickets';
import { TicketList } from '../../../components/tickets/ticket-list';

export default async function TicketsPage() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return <p>Not authenticated.</p>;
  }

  // TODO: Get organisationId from user's memberships or a org selector
  // For now, the API will use the x-organisation-id header
  const organisationId = 'default'; // placeholder — needs org selection UI

  let tickets: import('@ticketbot/shared-types').TicketDto[] = [];
  try {
    const result = await getTickets(session.access_token, organisationId);
    tickets = result.data;
  } catch {
    tickets = [];
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Tickets</h1>
        <a href="/tickets/new" style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', borderRadius: 6, textDecoration: 'none' }}>
          New Ticket
        </a>
      </div>
      <TicketList tickets={tickets} />
    </div>
  );
}
