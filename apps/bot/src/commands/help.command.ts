import { Telegraf } from 'telegraf';

export function registerHelpCommand(bot: Telegraf) {
  bot.help((ctx) => {
    ctx.reply(
      `Available commands:\n\n` +
        `/start — Welcome message and setup instructions\n` +
        `/link <token> — Link your Telegram account\n` +
        `/help — Show this help message\n\n` +
        `Once linked, you'll receive ticket notifications and can interact with them directly.`,
    );
  });
}
