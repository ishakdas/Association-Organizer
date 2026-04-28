import { Markup } from 'telegraf';

export const TASK_CALLBACK_PREFIX = {
  done: 'task_done',
  extend: 'task_extend',
  dismiss: 'task_dismiss',
  // Faz C: snooze submenu + inline calendar.
  // Short codes are deliberate — Telegram callback_data is capped at 64 bytes
  // and cuid task ids already eat ~25 of those.
  snooze: 'task_snz',
  snoozePreset: 'task_snz_p', // task_snz_p:<id>:<h1|d1|d3|w1>
  snoozeCal: 'task_snz_c', // task_snz_c:<id>:<yyyy-mm | now | noop>
  snoozeDay: 'task_snz_d', // task_snz_d:<id>:<yyyymmdd>
  back: 'task_back', // re-render the original assignment keyboard
  dispute: 'task_dispute', // assignee flags task as wrongly assigned
  accept: 'task_accept', // assignee accepts ownership on the assignment DM
} as const;

// Hatırlatıcı DM klavyesi. ⏰ Ertele snooze submenu'sünü açar (1 saat /
// Yarın / 3 gün / 1 hafta / inline takvim). Eski `task_extend` callback'i
// integration'da hâlâ kayıtlı — kullanıcının chat'inde duran eski
// hatırlatıcı DM'leri çalışmaya devam ediyor.
export function reminderActionsKeyboard(
  taskId: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tamamla', `${TASK_CALLBACK_PREFIX.done}:${taskId}`),
      Markup.button.callback('⏰ Ertele', `${TASK_CALLBACK_PREFIX.snooze}:${taskId}`),
    ],
    [Markup.button.callback('Kapat', `${TASK_CALLBACK_PREFIX.dismiss}:${taskId}`)],
  ]);
}
