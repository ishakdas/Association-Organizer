import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '@ticketbot/database';
import { registerStartCommand } from './commands/start.command';
import { registerLinkCommand } from './commands/link.command';
import { registerHelpCommand } from './commands/help.command';
import { registerCallbackQueryHandler } from './handlers/callback-query.handler';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(BotService.name);

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
    registerCallbackQueryHandler(this.bot, this.prisma);

    this.bot.catch((err: unknown, ctx: Context) => {
      this.logger.error(`Bot error for ${ctx.updateType}`, err);
    });

    this.logger.log('Bot commands registered');
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
}
