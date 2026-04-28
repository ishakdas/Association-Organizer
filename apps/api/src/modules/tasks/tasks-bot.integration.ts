import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  BotService,
  reminderActionsKeyboard,
  snoozeCalendarKeyboard,
  snoozeSubmenuKeyboard,
} from 'bot';
import { PrismaService } from '@ticketbot/database';
import { TasksService } from './tasks.service';
import { IcsTokenService } from './ics-token.service';

const TR_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ISTANBUL_OFFSET_MS = 3 * HOUR_MS; // Türkiye does not observe DST.

const SNOOZE_PRESET_DELTAS: Record<string, { ms: number; label: string }> = {
  h1: { ms: 1 * HOUR_MS, label: '1 saat' },
  d1: { ms: 1 * DAY_MS, label: 'Yarına' },
  d3: { ms: 3 * DAY_MS, label: '3 gün' },
  w1: { ms: 7 * DAY_MS, label: '1 hafta' },
};

@Injectable()
export class TasksBotIntegration implements OnModuleInit {
  private readonly logger = new Logger(TasksBotIntegration.name);

  constructor(
    private readonly botService: BotService,
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
    private readonly icsTokens: IcsTokenService,
  ) {}

  onModuleInit() {
    const bot = this.botService.getBot();

    bot.action(/^task_done:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        await this.tasks.markCompletedViaBot(taskId, userId);
        await ctx.editMessageText('✅ Tamamlandı').catch(() => undefined);
        await ctx.answerCbQuery('Tamamlandı');
      });
    });

    bot.action(/^task_extend:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        const task = await this.tasks.extendDueDate(taskId, userId, 1);
        const due = task.dueDate ? TR_FORMATTER.format(task.dueDate) : '—';
        await ctx
          .editMessageText(`⏭ 1 gün ertelendi\nYeni bitiş: ${due}`)
          .catch(() => undefined);
        await ctx.answerCbQuery('Ertelendi');
      });
    });

    bot.action(/^task_dismiss:(.+)$/, async (ctx) => {
      await ctx.deleteMessage().catch(() => undefined);
      await ctx.answerCbQuery('Kapatıldı');
    });

    // Open the snooze submenu — only swap the keyboard so the original
    // task description text stays visible.
    bot.action(/^task_snz:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        await this.tasks.getAssignmentBotContext(taskId, userId);
        await ctx
          .editMessageReplyMarkup(snoozeSubmenuKeyboard(taskId).reply_markup)
          .catch(() => undefined);
        await ctx.answerCbQuery();
      });
    });

    // Apply a snooze preset (h1 | d1 | d3 | w1). Delta is added to the
    // current dueDate when present; otherwise to "now" so a task without
    // a due date still shifts forward predictably.
    bot.action(/^task_snz_p:([^:]+):([a-z0-9]+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      const presetKey = ctx.match[2];
      const preset = SNOOZE_PRESET_DELTAS[presetKey];
      if (!preset) {
        await ctx.answerCbQuery('Geçersiz seçim');
        return;
      }
      await this.handleWithUser(ctx, async (userId) => {
        const ctxTask = await this.tasks.getAssignmentBotContext(
          taskId,
          userId,
        );
        const base = ctxTask.dueDate ?? new Date();
        const newDue = new Date(base.getTime() + preset.ms);
        const updated = await this.tasks.snoozeDueDateViaBot(
          taskId,
          userId,
          newDue,
        );
        const due = updated.dueDate
          ? TR_FORMATTER.format(updated.dueDate)
          : '—';
        await ctx
          .editMessageText(`⏰ Ertelendi (${preset.label})\nYeni bitiş: ${due}`)
          .catch(() => undefined);
        await ctx.answerCbQuery('Ertelendi');
      });
    });

    // Inline calendar — open at current Istanbul month, navigate by ym
    // (yyyy-mm), or no-op for header / weekday taps.
    bot.action(/^task_snz_c:([^:]+):([a-zA-Z0-9-]+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      const target = ctx.match[2];
      if (target === 'noop') {
        await ctx.answerCbQuery();
        return;
      }
      await this.handleWithUser(ctx, async (userId) => {
        await this.tasks.getAssignmentBotContext(taskId, userId);
        const ym = target === 'now' ? istanbulYearMonth() : parseYearMonth(target);
        if (!ym) {
          await ctx.answerCbQuery('Geçersiz ay');
          return;
        }
        await ctx
          .editMessageReplyMarkup(
            snoozeCalendarKeyboard(taskId, ym.year, ym.month).reply_markup,
          )
          .catch(() => undefined);
        await ctx.answerCbQuery();
      });
    });

    // Inline calendar day pick — yyyymmdd. The instant is built in
    // Istanbul local time at either the original dueDate's hour:minute
    // or 09:00 as a sane default, then converted to UTC.
    bot.action(/^task_snz_d:([^:]+):(\d{8})$/, async (ctx) => {
      const taskId = ctx.match[1];
      const ymd = ctx.match[2];
      await this.handleWithUser(ctx, async (userId) => {
        const ctxTask = await this.tasks.getAssignmentBotContext(
          taskId,
          userId,
        );
        const newDue = istanbulDateAtTimeOf(ymd, ctxTask.dueDate);
        if (!newDue) {
          await ctx.answerCbQuery('Geçersiz tarih');
          return;
        }
        const updated = await this.tasks.snoozeDueDateViaBot(
          taskId,
          userId,
          newDue,
        );
        const due = updated.dueDate
          ? TR_FORMATTER.format(updated.dueDate)
          : '—';
        await ctx
          .editMessageText(`⏰ Ertelendi\nYeni bitiş: ${due}`)
          .catch(() => undefined);
        await ctx.answerCbQuery('Ertelendi');
      });
    });

    // "Geri" from the snooze submenu → reminder klavyesine dön. Snooze
    // artık yalnızca hatırlatıcı DM'lerinde açıldığı için Geri'nin doğal
    // hedefi reminder keyboard. Eski atama DM'lerinden gelen click'ler
    // de reminder keyboard'una düşüyor — fark sadece kozmetik.
    bot.action(/^task_back:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        await this.tasks.getAssignmentBotContext(taskId, userId);
        await ctx
          .editMessageReplyMarkup(
            reminderActionsKeyboard(taskId).reply_markup,
          )
          .catch(() => undefined);
        await ctx.answerCbQuery();
      });
    });

    // "Kabul ediyorum" — assignee acknowledges ownership. Status flips
    // PENDING → IN_PROGRESS (handled in service). The 📅 Takvime ekle
    // URL button is preserved on the post-accept message so the
    // assignee can still add the deadline to their calendar.
    bot.action(/^task_accept:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        const updated = await this.tasks.acceptViaBot(taskId, userId);
        const icsUrl = updated.dueDate
          ? this.icsTokens.signTaskIcsUrl(taskId)
          : undefined;
        const extra = icsUrl
          ? {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Takvime ekle', url: icsUrl }],
                ],
              },
            }
          : undefined;
        await ctx
          .editMessageText(
            '✅ Kabul edildi.\nDurum: Devam ediyor. Hatırlatma vakti geldiğinde Tamamla / Ertele seçenekleri sunulacak.',
            extra,
          )
          .catch(() => undefined);
        await ctx.answerCbQuery('Kabul edildi');
      });
    });

    // "Bana ait değil" — assignee disputes the assignment. Manager
    // resolves from the web (Faz D/E). Reminder schedule is paused.
    bot.action(/^task_dispute:(.+)$/, async (ctx) => {
      const taskId = ctx.match[1];
      await this.handleWithUser(ctx, async (userId) => {
        await this.tasks.disputeViaBot(taskId, userId);
        await ctx
          .editMessageText(
            '❌ İtiraz iletildi.\nYöneticinin görevi yeniden atamasını bekliyoruz.',
          )
          .catch(() => undefined);
        await ctx.answerCbQuery('İtiraz iletildi');
      });
    });

    this.logger.log('Task bot callbacks registered');
  }

  private async handleWithUser(
    ctx: any,
    fn: (userId: string) => Promise<void>,
  ): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCbQuery('Hesap tanınmadı');
      return;
    }

    const account = await this.prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { userId: true },
    });
    if (!account) {
      await ctx.answerCbQuery('Hesabınız bağlı değil', { show_alert: true });
      return;
    }

    try {
      await fn(account.userId);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        await ctx.answerCbQuery('Bu göreve yetkiniz yok', { show_alert: true });
      } else if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      ) {
        await ctx.answerCbQuery((err as Error).message);
      } else {
        this.logger.error('Task callback failed', err as Error);
        await ctx.answerCbQuery('Bir şey ters gitti');
      }
    }
  }
}

// Current Istanbul {year, month} — Türkiye is UTC+3 with no DST, so we
// shift by +3h and read UTC fields rather than relying on Intl parsing.
function istanbulYearMonth(now = new Date()): { year: number; month: number } {
  const tz = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  return { year: tz.getUTCFullYear(), month: tz.getUTCMonth() + 1 };
}

function parseYearMonth(
  s: string,
): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

// Builds the UTC instant for a Istanbul-local YYYY-MM-DD pick. Time of
// day is preserved from `baseDue` when present; otherwise defaults to
// 09:00 Istanbul (= 06:00 UTC).
function istanbulDateAtTimeOf(ymd: string, baseDue: Date | null): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Read the base time-of-day in Istanbul to preserve "09:00 İstanbul"
  // semantics across the date shift.
  let hourTr = 9;
  let minuteTr = 0;
  if (baseDue) {
    const tz = new Date(baseDue.getTime() + ISTANBUL_OFFSET_MS);
    hourTr = tz.getUTCHours();
    minuteTr = tz.getUTCMinutes();
  }

  // Local Istanbul (year-month-day hourTr:minuteTr) → UTC by subtracting
  // the +3h offset.
  const localUtcMs = Date.UTC(year, month - 1, day, hourTr, minuteTr, 0, 0);
  const result = new Date(localUtcMs - ISTANBUL_OFFSET_MS);
  if (Number.isNaN(result.getTime())) return null;
  return result;
}
