import { Markup } from 'telegraf';
import { TASK_CALLBACK_PREFIX } from './reminder-actions.keyboard';

export interface AssignmentKeyboardOptions {
  // Public ICS download URL — only attached when the task has a due date.
  icsUrl?: string;
}

// Keyboard shown on the initial "yeni görev" DM. Matches the reminder
// keyboard's Tamamla + 1-day-extend actions and adds a "Takvime ekle"
// URL button when a due date exists. Faz C extends this with snooze
// presets and a "Bana ait değil" dispute callback.
export function assignmentActionsKeyboard(
  taskId: string,
  opts: AssignmentKeyboardOptions = {},
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Tamamla',
        `${TASK_CALLBACK_PREFIX.done}:${taskId}`,
      ),
      Markup.button.callback(
        '⏭ 1 gün ertele',
        `${TASK_CALLBACK_PREFIX.extend}:${taskId}`,
      ),
    ],
    ...(opts.icsUrl
      ? [[Markup.button.url('📅 Takvime ekle', opts.icsUrl)]]
      : []),
  ]);
}
