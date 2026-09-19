import { Telegraf } from 'telegraf';

export function registerHelpCommand(bot: Telegraf) {
  bot.help((ctx) => {
    ctx.reply(
      `Kullanılabilir komutlar:\n\n` +
        `/start — Karşılama ve kurulum yönergeleri\n` +
        `/link <kod> — Telegram hesabını bağla\n` +
        `/toplanti — Yeni toplantı notu ekle ve görevleri çıkar\n` +
        `/toplantilarim — Katıldığın toplantıları, özetleri ve görevleri görüntüle\n` +
        `/gorevlerim — Görevlerini görüntüle ve durumlarını yönet\n` +
        `/gorev — Yeni görev oluştur (başkan/sekreter)\n` +
        `/finans — Finans menüsü (gider/bağış/aidat/kasa)\n` +
        `/gider <tutar> [açıklama] — Hızlı gider kaydı\n` +
        `/bagis [tutar] [açıklama] — Bağış kaydı (tutar verilirse Genel'e; sadece /bagis ile tür seçilir)\n` +
        `/aidat — Aidat kaydı (üye ve ay seçimi)\n` +
        `/kasa — Kasa durumunu göster\n` +
        `/iptal — Devam eden sihirbazı iptal et\n` +
        `/help — Bu mesajı göster\n\n` +
        `Toplantıdan çıkan görevleri kabul etme, itiraz etme, tamamlama ve erteleme ` +
        `işlemlerinin tamamını Telegram üzerinden yapabilirsin.`,
    );
  });
}
