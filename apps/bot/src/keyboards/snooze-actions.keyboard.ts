import { Markup } from 'telegraf';
import { TASK_CALLBACK_PREFIX } from './reminder-actions.keyboard';

// Submenu shown after the assignee taps "⏰ Ertele" on the assignment
// DM. Four presets (1 saat / Yarın / 3 gün / 1 hafta) plus an entry
// into the inline calendar for arbitrary dates. "Geri" returns to the
// original assignment keyboard.
export function snoozeSubmenuKeyboard(
  taskId: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  const P = TASK_CALLBACK_PREFIX.snoozePreset;
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('+1 saat', `${P}:${taskId}:h1`),
      Markup.button.callback('Yarın', `${P}:${taskId}:d1`),
    ],
    [
      Markup.button.callback('+3 gün', `${P}:${taskId}:d3`),
      Markup.button.callback('+1 hafta', `${P}:${taskId}:w1`),
    ],
    [
      Markup.button.callback(
        '📅 Tarih seç',
        `${TASK_CALLBACK_PREFIX.snoozeCal}:${taskId}:now`,
      ),
    ],
    [
      Markup.button.callback(
        '⬅️ Geri',
        `${TASK_CALLBACK_PREFIX.back}:${taskId}`,
      ),
    ],
  ]);
}

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

// Inline month-grid calendar. Built as a 7-column keyboard:
//   Row 1: ◀  <month yyyy>  ▶
//   Row 2: Pt Sa Ça Pe Cu Ct Pa
//   Rows 3+: day buttons (1..N) padded with no-op blanks
//   Last:   ⬅️ Geri (returns to snooze submenu)
//
// Calendar math runs in Europe/Istanbul, which has no DST — so weekday
// derivation via Date.UTC is timezone-stable. Day pick fires
// `task_snz_d:<taskId>:<yyyymmdd>` — the integration computes the final
// dueDate by preserving the original time-of-day component when present.
export function snoozeCalendarKeyboard(
  taskId: string,
  year: number,
  month: number, // 1-indexed
): ReturnType<typeof Markup.inlineKeyboard> {
  const NOOP = `${TASK_CALLBACK_PREFIX.snoozeCal}:${taskId}:noop`;
  const navCb = (ym: string) =>
    `${TASK_CALLBACK_PREFIX.snoozeCal}:${taskId}:${ym}`;
  const dayCb = (ymd: string) =>
    `${TASK_CALLBACK_PREFIX.snoozeDay}:${taskId}:${ymd}`;

  const prevYM = month === 1 ? `${year - 1}-12` : `${year}-${pad2(month - 1)}`;
  const nextYM = month === 12 ? `${year + 1}-01` : `${year}-${pad2(month + 1)}`;

  const first = new Date(Date.UTC(year, month - 1, 1));
  const jsDow = first.getUTCDay(); // 0=Sun..6=Sat
  const monStart = (jsDow + 6) % 7; // shift so Mon=0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  rows.push([
    Markup.button.callback('◀', navCb(prevYM)),
    Markup.button.callback(`${TR_MONTHS[month - 1]} ${year}`, NOOP),
    Markup.button.callback('▶', navCb(nextYM)),
  ]);

  rows.push(
    ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'].map((label) =>
      Markup.button.callback(label, NOOP),
    ),
  );

  type Cell = { label: string; cb: string };
  const cells: Cell[] = [];
  for (let i = 0; i < monStart; i++) cells.push({ label: ' ', cb: NOOP });
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}${pad2(month)}${pad2(d)}`;
    cells.push({ label: String(d), cb: dayCb(ymd) });
  }
  while (cells.length % 7 !== 0) cells.push({ label: ' ', cb: NOOP });

  for (let r = 0; r < cells.length; r += 7) {
    rows.push(
      cells.slice(r, r + 7).map((c) => Markup.button.callback(c.label, c.cb)),
    );
  }

  rows.push([
    Markup.button.callback(
      '⬅️ Geri',
      `${TASK_CALLBACK_PREFIX.snooze}:${taskId}`,
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
