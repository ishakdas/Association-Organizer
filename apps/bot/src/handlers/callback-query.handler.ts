import { Telegraf } from 'telegraf';
import { PrismaService } from '@ticketbot/database';

export function registerCallbackQueryHandler(bot: Telegraf, prisma: PrismaService) {
  // Handle "Mark as done" callback from reminder messages
  bot.action(/^ticket_done:(.+)$/, async (ctx) => {
    const ticketId = ctx.match[1];
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return ctx.answerCbQuery('Ticket not found.');
      }

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'RESOLVED' },
      });

      await prisma.ticketStatusHistory.create({
        data: {
          ticketId,
          fromStatus: ticket.status,
          toStatus: 'RESOLVED',
        },
      });

      await ctx.editMessageReplyMarkup(undefined);
      return ctx.answerCbQuery('Ticket marked as resolved!');
    } catch {
      return ctx.answerCbQuery('Failed to update ticket.');
    }
  });

  // Handle "Request extension" callback
  bot.action(/^ticket_extend:(.+)$/, async (ctx) => {
    const ticketId = ctx.match[1];
    // TODO: Implement extension request flow — prompt user for new deadline and reason
    return ctx.answerCbQuery('Extension requests will be available soon.');
  });

  // Handle "Dismiss" callback
  bot.action(/^ticket_dismiss:(.+)$/, async (ctx) => {
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.answerCbQuery('Reminder dismissed.');
  });
}
