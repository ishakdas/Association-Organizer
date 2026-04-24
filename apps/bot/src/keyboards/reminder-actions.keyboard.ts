import { Markup } from 'telegraf';

export const TASK_CALLBACK_PREFIX = {
  done: 'task_done',
  extend: 'task_extend',
  dismiss: 'task_dismiss',
} as const;

export function reminderActionsKeyboard(
  taskId: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tamamla', `${TASK_CALLBACK_PREFIX.done}:${taskId}`),
      Markup.button.callback('⏭ 1 gün ertele', `${TASK_CALLBACK_PREFIX.extend}:${taskId}`),
    ],
    [Markup.button.callback('Kapat', `${TASK_CALLBACK_PREFIX.dismiss}:${taskId}`)],
  ]);
}
