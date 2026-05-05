import { Telegraf } from 'telegraf';

export function registerHelpCommand(bot: Telegraf) {
  bot.help((ctx) => {
    ctx.reply(
      `Kullanılabilir komutlar:\n\n` +
        `/start — Karşılama ve kurulum yönergeleri\n` +
        `/link <kod> — Telegram hesabını bağla\n` +
        `/toplanti — Yeni toplantı notu ekle (adım adım sihirbaz)\n` +
        `/iptal — Devam eden toplantı sihirbazını iptal et\n` +
        `/help — Bu mesajı göster\n\n` +
        `Hesabını bağladıktan sonra görev hatırlatmalarını burada alırsın ` +
        `ve doğrudan toplantı notu ekleyebilirsin.`,
    );
  });
}
