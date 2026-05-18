import { Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ticketbot/database';
import { startPendingLink } from './link.command';

export function registerStartCommand(bot: Telegraf, config: ConfigService, prisma: PrismaService) {
  bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    const fromId = ctx.from?.id;

    console.log(`[bot:start] user=${fromId} payload="${payload}"`);

    if (payload?.startsWith('link_')) {
      const token = payload.slice(5);
      console.log(`[bot:start] deeplink detected, token=${token}`);
      return startPendingLink(ctx, prisma, token);
    }

    // Normal /start (no deeplink payload) — show welcome + instructions
    const webUrl = config.get<string>('webUrl') ?? 'http://localhost:3001';
    await ctx.reply(
      `👋 Merhaba! Yedi Hilal Organizatör botuna hoş geldiniz.\n\n` +
        `📧 E-postanızdaki "Telegram'da Aç" butonuna tıkladıysanız, ` +
        `bağlantı otomatik olarak başlamış olmalı.\n\n` +
        `Eğer bağlantı başlamadıysa lütfen şu adımları izleyin:\n` +
        `1. Yönetim paneline giriş yapın: ${webUrl}\n` +
        `2. Ayarlar → Telegram bölümüne gidin\n` +
        `3. "Bağlantı kodu üret" butonuna tıklayın\n` +
        `4. Gelen kodu buraya yazın: /link <kod>\n\n` +
        `Yardım için /help yazabilirsiniz.`,
    );
  });
}
