import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import type { InlineKeyboardMarkup, Update } from 'telegraf/types';
import { PrismaService } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';
import { registerStartCommand } from './commands/start.command';
import { registerLinkCommand } from './commands/link.command';
import { registerHelpCommand } from './commands/help.command';
import { registerMeetingWizard } from './wizards/meeting.wizard';
import { registerMeetingListCommand } from './wizards/meeting-list.wizard';
import { registerTaskListCommand } from './wizards/task-list.wizard';
import { registerFinanceWizard } from './wizards/finance.wizard';
import { registerTaskCreateWizard } from './wizards/task-create.wizard';

export interface SendToUserOptions {
  replyMarkup?: InlineKeyboardMarkup;
  parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML';
}

export interface BotTaskCreateInput {
  title: string;
  description?: string | null;
  assignedToUserId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  reminderAt?: string | null;
  reminderFrequency?: 'NONE' | 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  sourceMeetingNoteId?: string;
}

export interface BotCreatedTask {
  id: string;
  title: string;
  dueDate: Date | null;
  assignedTo?: { fullName: string } | null;
}

// Dependency-inversion port: the bot lib cannot import the API's
// TasksService (the API depends on the bot, not the reverse). The API
// registers an adapter at startup so wizard-created tasks go through the
// same TasksService.create path (reminder scheduling, atama klavyesi,
// üyelik doğrulaması) as web-created ones.
export type BotTaskCreatePort = (
  associationId: string,
  input: BotTaskCreateInput,
  actingUserId: string,
) => Promise<BotCreatedTask>;

export type BotTaskCreateManyPort = (
  associationId: string,
  inputs: BotTaskCreateInput[],
  actingUserId: string,
) => Promise<BotCreatedTask[]>;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private readonly logger = new Logger(BotService.name);
  private polling = false;
  private taskCreatePort: BotTaskCreatePort | null = null;
  private taskCreateManyPort: BotTaskCreateManyPort | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    if (!this.config.get<boolean>('bot.enabled')) return;
    const token = this.config.get<string>('bot.token');
    if (!token) throw new Error('Telegram bot token is missing');
    this.bot = new Telegraf(token);
  }

  async onModuleInit() {
    const bot = this.bot;
    if (!bot) {
      this.logger.log('Telegram bot disabled');
      return;
    }
    registerStartCommand(bot, this.config, this.prisma);
    registerLinkCommand(bot, this.prisma);
    registerHelpCommand(bot);
    const createMeetingTasks = (
      associationId: string,
      inputs: BotTaskCreateInput[],
      actingUserId: string,
    ) => this.createTasks(associationId, inputs, actingUserId);
    registerMeetingWizard(bot, this.prisma, this.aiService, createMeetingTasks);
    registerMeetingListCommand(bot, this.prisma, this.aiService, createMeetingTasks);
    registerTaskListCommand(bot, this.prisma);
    registerFinanceWizard(bot, this.prisma);
    registerTaskCreateWizard(bot, this.prisma, this);

    // iPhone/Android'da bot menüsünün görünmesi için komut listesini ayarla
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: 'Botu başlat' },
        { command: 'help', description: 'Yardım ve komutlar' },
        { command: 'link', description: 'Hesap bağlama' },
        { command: 'toplanti', description: 'Toplantı notu ekle' },
        { command: 'toplantilarim', description: 'Toplantılarını listele' },
        { command: 'gorevlerim', description: 'Görevleri listele' },
        { command: 'gorev', description: 'Yeni görev oluştur (Başkan/Sekreter)' },
        { command: 'finans', description: 'Finans menüsü' },
        { command: 'gider', description: 'Gider ekle' },
        { command: 'bagis', description: 'Bağış kaydet' },
        { command: 'aidat', description: 'Aidat al' },
        { command: 'kasa', description: 'Kasa durumu' },
        { command: 'gecmis', description: 'İşlem geçmişi' },
        { command: 'ozet', description: 'Aylık özet' },
        { command: 'iptal', description: 'İşlemi iptal et' },
      ]);
      this.logger.log('Bot command menu set');
    } catch (err) {
      this.logger.warn(`Failed to set bot command menu: ${(err as Error).message}`);
    }

    bot.on('text', async (ctx, next) => {
      const text = ctx.message?.text;
      if (text?.startsWith('/')) {
        return ctx.reply(
          '⚠️ Böyle bir komut bulunmamaktadır. Kullanılabilir komutları ' +
            'görmek için /help yazabilirsin.',
        );
      }
      return next();
    });

    bot.catch((err: unknown, ctx: Context) => {
      console.error('=== [BOT] GLOBAL CATCH HANDLER ===');
      console.error('[BOT] Error:', err);
      console.error('[BOT] Update type:', ctx.updateType);
      console.error('[BOT] Error stack:', err instanceof Error ? err.stack : 'N/A');
      this.logger.error(`Bot error for ${ctx.updateType}`, err);
    });

    this.logger.log('Bot commands registered');

    // Local-dev fallback: when API_URL is missing or points at localhost,
    // Telegram cannot deliver webhooks back to us. Switch to long polling
    // so /start, /link, /help still work via `pnpm dev`. In production
    // (apiUrl is a public URL), main.ts wires the webhook instead.
    const apiUrl = this.config.get<string>('apiUrl') ?? '';
    const nodeEnv = this.config.get<string>('nodeEnv');
    const isLocal =
      !apiUrl ||
      apiUrl.includes('localhost') ||
      apiUrl.includes('127.0.0.1') ||
      apiUrl.startsWith('http://0.0.0.0');
    if (nodeEnv !== 'test' && isLocal) {
      // Drop any leftover webhook before polling — Telegram refuses both
      // at once and silently returns 409 conflicts otherwise.
      bot.telegram
        .deleteWebhook({ drop_pending_updates: false })
        .catch((err) =>
          this.logger.warn(`deleteWebhook before polling failed: ${(err as Error).message}`),
        )
        .then(() => {
          this.polling = true;
          // Telegraf's launch() resolves only when the bot stops, so we
          // intentionally do not await it here.
          bot
            .launch()
            .catch((err) => this.logger.error(`Long polling failed: ${(err as Error).message}`));
          this.logger.log('Bot started in long-polling mode (local dev)');
        });
    }
  }

  async onModuleDestroy() {
    if (this.polling && this.bot) {
      this.bot.stop('SIGTERM');
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    if (!this.bot) throw new Error('Telegram bot is disabled');
    await this.bot.handleUpdate(update);
  }

  async setWebhook(url: string, secretToken?: string) {
    if (!this.bot) throw new Error('Telegram bot is disabled');
    await this.bot.telegram.setWebhook(url, {
      secret_token: secretToken,
    });
    this.logger.log(`Webhook set to ${url}`);
  }

  getTelegram() {
    if (!this.bot) throw new Error('Telegram bot is disabled');
    return this.bot.telegram;
  }

  getBot(): Telegraf {
    if (!this.bot) throw new Error('Telegram bot is disabled');
    return this.bot;
  }

  isEnabled(): boolean {
    return this.bot !== null;
  }

  // Registered by the API (TasksBotIntegration) at startup.
  setTaskCreatePort(port: BotTaskCreatePort): void {
    this.taskCreatePort = port;
  }

  setTaskCreateManyPort(port: BotTaskCreateManyPort): void {
    this.taskCreateManyPort = port;
  }

  // Create a task through the API's TasksService (reminder jobs, atama
  // klavyesi, üyelik kontrolü dahil). Throws if the API hasn't wired the
  // port — the bot always runs inside the API process, so that is a bug.
  async createTask(
    associationId: string,
    input: BotTaskCreateInput,
    actingUserId: string,
  ): Promise<BotCreatedTask> {
    if (!this.taskCreatePort) {
      throw new Error('Görev oluşturma servisi hazır değil');
    }
    return this.taskCreatePort(associationId, input, actingUserId);
  }

  async createTasks(
    associationId: string,
    inputs: BotTaskCreateInput[],
    actingUserId: string,
  ): Promise<BotCreatedTask[]> {
    if (!this.taskCreateManyPort) {
      throw new Error('Toplu görev oluşturma servisi hazır değil');
    }
    return this.taskCreateManyPort(associationId, inputs, actingUserId);
  }

  async sendToUser(userId: string, text: string, opts?: SendToUserOptions): Promise<boolean> {
    if (!this.bot) return false;
    const account = await this.prisma.telegramAccount.findUnique({
      where: { userId },
      select: { telegramId: true },
    });
    if (!account) return false;

    try {
      await this.bot.telegram.sendMessage(Number(account.telegramId), text, {
        parse_mode: opts?.parseMode ?? 'MarkdownV2',
        reply_markup: opts?.replyMarkup,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Telegram send failed for user ${userId}: ${(err as Error).message}`);
      return false;
    }
  }
}
