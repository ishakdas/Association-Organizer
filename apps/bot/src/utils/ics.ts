// Minimal RFC 5545 ICS generator for task deadlines.
//
// Stable UID + monotonic SEQUENCE means re-importing the same .ics
// updates the existing calendar entry rather than creating a duplicate.
// Date-only deadlines become all-day events; deadlines with a time
// component become a 1-hour block starting at the deadline.

export interface TaskIcsPayload {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  updatedAt: Date;
}

const PRODID = '-//Aktivist//Task//TR';

export function buildTaskIcs(
  task: TaskIcsPayload,
  uidDomain: string,
): string {
  const uid = `task-${task.id}@${uidDomain}`;
  const sequence = Math.floor(task.updatedAt.getTime() / 1000);
  const dtstamp = formatUtc(new Date());
  const summary = escapeText(task.title);
  const description = task.description
    ? escapeText(task.description.slice(0, 1000))
    : '';

  const allDay = isAllDay(task.dueDate);
  const dateLines = allDay
    ? [
        `DTSTART;VALUE=DATE:${formatDate(task.dueDate)}`,
        `DTEND;VALUE=DATE:${formatDate(addDays(task.dueDate, 1))}`,
      ]
    : [
        `DTSTART:${formatUtc(task.dueDate)}`,
        `DTEND:${formatUtc(addHours(task.dueDate, 1))}`,
      ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    ...dateLines,
    `SEQUENCE:${sequence}`,
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}

function isAllDay(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0
  );
}

function formatUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 3_600_000);
}

// RFC 5545 §3.3.11 — escape backslash, semicolon, comma; encode newlines.
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
