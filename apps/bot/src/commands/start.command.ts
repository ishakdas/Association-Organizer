import { Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';

export function registerStartCommand(bot: Telegraf, config: ConfigService) {
  bot.start((ctx) => {
    const webUrl = config.get<string>('webUrl') ?? 'http://localhost:3001';
    ctx.reply(
      `Welcome to TicketBot! 🎫\n\n` +
        `To link your Telegram account:\n` +
        `1. Log in to the dashboard at ${webUrl}\n` +
        `2. Go to Settings → Telegram\n` +
        `3. Click "Generate Link Code"\n` +
        `4. Paste the code here: /link <code>\n\n` +
        `Type /help for available commands.`,
    );
  });
}
