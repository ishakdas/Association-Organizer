import { Telegraf } from 'telegraf';
import { PrismaService } from '@ticketbot/database';

/**
 * Bot callback handlers. The previous Ticket-domain handlers were removed
 * after the schema pivot to associations + tasks. New handlers (task_done,
 * task_extend, task_dismiss) will be wired up alongside the Tasks API and
 * BullMQ reminder pipeline.
 */
export function registerCallbackQueryHandler(_bot: Telegraf, _prisma: PrismaService) {
  // Intentionally empty — no callbacks registered yet for the new domain.
}
