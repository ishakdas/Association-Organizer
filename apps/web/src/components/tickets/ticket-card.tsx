import type { TicketDto } from '@ticketbot/shared-types';

const priorityColors: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  URGENT: '#ef4444',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export function TicketCard({ ticket }: { ticket: TicketDto }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderLeft: `4px solid ${priorityColors[ticket.priority] ?? '#9ca3af'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{ticket.title}</h3>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 12,
            backgroundColor: '#f3f4f6',
          }}
        >
          {statusLabels[ticket.status] ?? ticket.status}
        </span>
      </div>
      {ticket.description && (
        <p style={{ color: '#6b7280', fontSize: 14, margin: '4px 0' }}>
          {ticket.description.length > 120
            ? `${ticket.description.slice(0, 120)}...`
            : ticket.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
        <span>Priority: {ticket.priority}</span>
        {ticket.dueDate && <span>Due: {new Date(ticket.dueDate).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
