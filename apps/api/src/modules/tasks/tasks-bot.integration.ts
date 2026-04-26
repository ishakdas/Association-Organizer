import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { BotService } from 'bot';
import { PrismaService } from '@ticketbot/database';
import { TasksService } from './tasks.service';

const TR_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

@Injectable()
export class TasksBotIntegration implements OnModuleInit {
  private readonly logger = new Logger(TasksBotIntegration.name);

  constructor(
    private readonly botService: BotService,
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
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
