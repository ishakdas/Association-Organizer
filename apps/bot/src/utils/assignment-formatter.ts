import { TaskMessagePayload, escapeMarkdown } from './message-formatter';

const TR_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

function formatDate(d: Date | null): string {
  if (!d) return 'Bitiş tarihi belirtilmedi';
  return TR_FORMATTER.format(d);
}

// DM sent the moment a task is assigned. Distinct from the reminder
// flow because the framing ("sana yeni bir görev atandı") and the
// Takvime ekle action only make sense at assignment time.
export function formatAssignmentMessage(
  task: TaskMessagePayload,
  assignedBy: string | null,
): string {
  const title = escapeMarkdown(task.title);
  const due = escapeMarkdown(formatDate(task.dueDate));
  const priority = escapeMarkdown(
    PRIORITY_LABELS[task.priority] ?? task.priority,
  );
  const descLine = task.description
    ? `\n${escapeMarkdown(task.description.slice(0, 300))}`
    : '';
  const byLine = assignedBy
    ? `\n👤 Atayan: ${escapeMarkdown(assignedBy)}`
    : '';

  return (
    `📌 *Sana yeni bir görev atandı*\n\n` +
    `*${title}*${descLine}\n\n` +
    `📅 Bitiş: ${due}\n` +
    `⚡ Öncelik: ${priority}` +
    byLine
  );
}
