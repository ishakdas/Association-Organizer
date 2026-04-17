import { Markup } from 'telegraf';

export function reminderActionsKeyboard(ticketId: string): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Done', `ticket_done:${ticketId}`),
      Markup.button.callback('⏰ Request Extension', `ticket_extend:${ticketId}`),
    ],
    [Markup.button.callback('Dismiss', `ticket_dismiss:${ticketId}`)],
  ]);
}
