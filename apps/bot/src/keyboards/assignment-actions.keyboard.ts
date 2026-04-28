import { Markup } from 'telegraf';
import { TASK_CALLBACK_PREFIX } from './reminder-actions.keyboard';

export interface AssignmentKeyboardOptions {
  // Public ICS download URL — only attached when the task has a due date.
  icsUrl?: string;
}

// Initial "yeni görev" DM keyboard. Scoped to the ownership decision:
//   📋 Kabul ediyorum  → assignee acknowledges, ASSIGNMENT_ACCEPTED logged
//   ❌ Bana ait değil  → dispute flag, manager resolves from the web
//   📅 Takvime ekle    → ICS URL (only when dueDate is set)
// Completion + snooze live on the reminder DM, not here — the first DM
// is for "üstlen veya itiraz et", not for executing the task.
export function assignmentActionsKeyboard(
  taskId: string,
  opts: AssignmentKeyboardOptions = {},
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '📋 Kabul ediyorum',
        `${TASK_CALLBACK_PREFIX.accept}:${taskId}`,
      ),
    ],
    [
      Markup.button.callback(
        '❌ Bana ait değil',
        `${TASK_CALLBACK_PREFIX.dispute}:${taskId}`,
      ),
    ],
    ...(opts.icsUrl
      ? [[Markup.button.url('📅 Takvime ekle', opts.icsUrl)]]
      : []),
  ]);
}
