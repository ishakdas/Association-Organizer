import type { TicketDto } from '@ticketbot/shared-types';
import { TicketCard } from './ticket-card';

export function TicketList({ tickets }: { tickets: TicketDto[] }) {
  if (tickets.length === 0) {
    return <p style={{ color: '#6b7280' }}>No tickets found.</p>;
  }

  return (
    <div>
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
