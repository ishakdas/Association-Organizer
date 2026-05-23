import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';
import { registerStartCommand } from './commands/start.command';
import { registerLinkCommand } from './commands/link.command';
import { registerHelpCommand } from './commands/help.command';
import { registerMeetingWizard } from './wizards/meeting.wizard';
import { registerMeetingListCommand } from './wizards/meeting-list.wizard';
import { registerTaskListCommand } from './wizards/task-list.wizard';
import { registerFinanceWizard } from './wizards/finance.wizard';

export interface SendToUserOptions {
  replyMarkup?: unknown;
  parseMode?: 'MarkdownV2' | 'HTML';
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private readonly logger = new Logger(BotService.name);
  private polling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    const token = this.config.get<string>('bot.token')!;
    this.bot = new Telegraf(token);
  }

  async onModuleInit() {
    registerStartCommand(this.bot, this.config, this.prisma);
    registerLinkCommand(this.bot, this.prisma, this.config);
    registerHelpCommand(this.bot);
    registerMeetingWizard(this.bot, this.prisma, this.aiService);
    registerMeetingListCommand(this.bot, this.prisma, this.aiService);
    registerTaskListCommand(this.bot, this.prisma);
    registerFinanceWizard(this.bot, this.prisma);

    // iPhone/Android'da bot menüsünün görünmesi için komut listesini ayarla
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Botu başlat' },
        { command: 'help', description: 'Yardım ve komutlar' },
        { command: 'link', description: 'Hesap bağlama' },
        { command: 'toplanti', description: 'Toplantı notu ekle' },
        { command: 'toplantilarim', description: 'Toplantılarını listele' },
        { command: 'gorevlerim', description: 'Görevleri listele' },
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
      this.logger.warn(
        `Failed to set bot command menu: ${(err as Error).message}`,
      );
    }

    this.bot.on('text', async (ctx, next) => {
      const text = ctx.message?.text;
      if (text?.startsWith('/')) {
        return ctx.reply(
          '⚠️ Böyle bir komut bulunmamaktadır. Kullanılabilir komutları ' +
            'görmek için /help yazabilirsin.',
        );
      }
      return next();
    });

    this.bot.catch((err: unknown, ctx: Context) => {
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
      this.bot.telegram
        .deleteWebhook({ drop_pending_updates: false })
        .catch((err) =>
          this.logger.warn(
            `deleteWebhook before polling failed: ${(err as Error).message}`,
          ),
        )
        .then(() => {
          this.polling = true;
          // Telegraf's launch() resolves only when the bot stops, so we
          // intentionally do not await it here.
          this.bot
            .launch()
            .catch((err) =>
              this.logger.error(
                `Long polling failed: ${(err as Error).message}`,
              ),
            );
          this.logger.log('Bot started in long-polling mode (local dev)');
        });
    }
  }

  async onModuleDestroy() {
    if (this.polling) {
      this.bot.stop('SIGTERM');
    }
  }

  async handleUpdate(update: unknown) {
    process.stdout.write('\n### [BOT] handleUpdate ENTRY ###\n');
    process.stdout.write('[BOT] Has bot instance: ' + !!this.bot + '\n');
    process.stdout.write('[BOT] Update type: ' + typeof update + '\n');
    
    const updateStr = JSON.stringify(update);
    process.stdout.write('[BOT] Update preview: ' + updateStr.slice(0, 200) + '\n');
    
    const updateObj = update as any;
    if (updateObj?.callback_query) {
      process.stdout.write('[BOT] Callback data: ' + updateObj.callback_query.data + '\n');
    } else if (updateObj?.message) {
      process.stdout.write('[BOT] Message text: ' + (updateObj.message.text?.slice(0, 100) || 'none') + '\n');
    }
    
    try {
      process.stdout.write('### [BOT] Calling this.bot.handleUpdate() ###\n');
      await this.bot.handleUpdate(update as any);
      process.stdout.write('### [BOT] this.bot.handleUpdate() completed ###\n');
    } catch (err) {
      process.stdout.write('### [BOT] ERROR in this.bot.handleUpdate() ###\n');
      process.stdout.write('[BOT] Error: ' + (err instanceof Error ? err.message : String(err)) + '\n');
      process.stdout.write('[BOT] Stack: ' + (err instanceof Error ? err.stack : 'N/A') + '\n');
    }
  }

  async setWebhook(url: string, secretToken?: string) {
    await this.bot.telegram.setWebhook(url, {
      secret_token: secretToken,
    });
    this.logger.log(`Webhook set to ${url}`);
  }

  getTelegram() {
    return this.bot.telegram;
  }

  getBot(): Telegraf {
    return this.bot;
  }

  async sendToUser(
    userId: string,
    text: string,
    opts?: SendToUserOptions,
  ): Promise<boolean> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { userId },
      select: { telegramId: true },
    });
    if (!account) return false;

    try {
      await this.bot.telegram.sendMessage(Number(account.telegramId), text, {
        parse_mode: opts?.parseMode ?? 'MarkdownV2',
        reply_markup: opts?.replyMarkup as any,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Telegram send failed for user ${userId}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
