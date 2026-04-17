// Telegram MarkdownV2 requires escaping these characters
const SPECIAL_CHARS = /([_*\[\]()~`>#+\-=|{}.!])/g;

export function escapeMarkdown(text: string): string {
  return text.replace(SPECIAL_CHARS, '\\$1');
}

export function formatReminderMessage(ticket: {
  id: string;
  title: string;
  dueDate: Date | null;
  status: string;
}): string {
  const title = escapeMarkdown(ticket.title);
  const due = ticket.dueDate
    ? escapeMarkdown(ticket.dueDate.toISOString().split('T')[0])
    : 'No deadline';

  return (
    `🔔 *Ticket Reminder*\n\n` +
    `*${title}*\n` +
    `Status: ${escapeMarkdown(ticket.status)}\n` +
    `Due: ${due}\n\n` +
    `This ticket is due soon\\. Please take action\\.`
  );
}
