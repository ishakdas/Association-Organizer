import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '@ticketbot/database';
import { registerStartCommand } from './commands/start.command';
import { registerLinkCommand } from './commands/link.command';
import { registerHelpCommand } from './commands/help.command';

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
  ) {
    const token = this.config.get<string>('bot.token')!;
    this.bot = new Telegraf(token);
  }

  onModuleInit() {
    registerStartCommand(this.bot, this.config);
    registerLinkCommand(this.bot, this.prisma, this.config);
    registerHelpCommand(this.bot);

    this.bot.catch((err: unknown, ctx: Context) => {
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
    await this.bot.handleUpdate(update as any);
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
