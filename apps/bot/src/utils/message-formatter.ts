const SPECIAL_CHARS = /([_*\[\]()~`>#+\-=|{}.!])/g;

export function escapeMarkdown(text: string): string {
  return text.replace(SPECIAL_CHARS, '\\$1');
}

const TR_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

function formatDate(d: Date | null): string {
  if (!d) return 'Tarihsiz';
  return TR_FORMATTER.format(d);
}

export interface TaskMessagePayload {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: string;
  priority: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

export function formatDueMessage(task: TaskMessagePayload): string {
  const title = escapeMarkdown(task.title);
  const due = escapeMarkdown(formatDate(task.dueDate));
  const priority = escapeMarkdown(PRIORITY_LABELS[task.priority] ?? task.priority);
  const descLine = task.description
    ? `\n${escapeMarkdown(task.description.slice(0, 200))}`
    : '';

  return (
    `🔴 *Görevin teslim tarihi geldi*\n\n` +
    `*${title}*${descLine}\n\n` +
    `📅 ${due}\n` +
    `⚡ Öncelik: ${priority}`
  );
}

export function formatReminderMessage(task: TaskMessagePayload): string {
  const title = escapeMarkdown(task.title);
  const due = escapeMarkdown(formatDate(task.dueDate));
  const priority = escapeMarkdown(PRIORITY_LABELS[task.priority] ?? task.priority);
  const descLine = task.description
    ? `\n${escapeMarkdown(task.description.slice(0, 200))}`
    : '';

  return (
    `🔔 *Görev hatırlatması*\n\n` +
    `*${title}*${descLine}\n\n` +
    `📅 Teslim: ${due}\n` +
    `⚡ Öncelik: ${priority}`
  );
}
