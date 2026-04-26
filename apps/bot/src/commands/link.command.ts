import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '@ticketbot/database';
import { ConfigService } from '@nestjs/config';
import { parsePhoneE164 } from '@ticketbot/shared-validation';

interface PendingLink {
  token: string;
  userId: string;
  expectedPhoneE164: string;
  expiresAt: number;
}

// Bot runs inside the API process — a single in-memory map is fine. Token
// TTL is short (10 min from issuance) so unbounded growth is not a concern.
const pendingLinks = new Map<number, PendingLink>();
const PENDING_TTL_MS = 10 * 60 * 1000;

function evictExpired(now: number) {
  for (const [k, v] of pendingLinks) {
    if (v.expiresAt <= now) pendingLinks.delete(k);
  }
}

const removeKeyboard = { reply_markup: { remove_keyboard: true as const } };

export function registerLinkCommand(
  bot: Telegraf,
  prisma: PrismaService,
  // ConfigService is part of the public signature for parity with other
  // command registrars; not used directly here.
  _config: ConfigService,
) {
  bot.command('link', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const token = args[0];

    if (!token) {
      return ctx.reply(
        'Kullanım: /link <kod>\n\nWeb panelinden bir bağlantı kodu alın.',
      );
    }

    try {
      const linkToken = await prisma.telegramLinkToken.findUnique({
        where: { token },
      });

      if (!linkToken) {
        return ctx.reply('Geçersiz kod. Lütfen panelden yenisini alın.');
      }
      if (linkToken.usedAt) {
        return ctx.reply(
          'Bu kod zaten kullanılmış. Lütfen panelden yenisini alın.',
        );
      }
      if (linkToken.expiresAt < new Date()) {
        return ctx.reply(
          'Bu kodun süresi dolmuş. Lütfen panelden yenisini alın.',
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: linkToken.userId },
        select: { id: true, phone: true, fullName: true },
      });
      if (!user) {
        return ctx.reply('Kullanıcı bulunamadı. Destek ekibiyle görüşün.');
      }

      if (!user.phone) {
        return ctx.reply(
          'Hesabınızda kayıtlı telefon yok.\n\n' +
            'Lütfen önce web panelinden Profil → Telefon ile numaranızı ekleyin, ' +
            'sonra yeni bir bağlantı kodu alarak tekrar deneyin.',
        );
      }

      const expectedPhone = parsePhoneE164(user.phone);
      if (!expectedPhone) {
        return ctx.reply(
          'Hesabınızdaki telefon biçimi okunamadı. Destek ekibiyle görüşün.',
        );
      }

      const now = Date.now();
      evictExpired(now);
      pendingLinks.set(ctx.from.id, {
        token,
        userId: user.id,
        expectedPhoneE164: expectedPhone,
        expiresAt: Math.min(now + PENDING_TTL_MS, linkToken.expiresAt.getTime()),
      });

      return ctx.reply(
        `Merhaba ${user.fullName}!\n\n` +
          'Hesabınızı bağlamadan önce, kayıtlı telefonunuzla aynı olduğunu ' +
          'doğrulamak için lütfen telefon numaranızı paylaşın.',
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Telefonu paylaş')],
        ])
          .oneTime()
          .resize(),
      );
    } catch {
      return ctx.reply(
        'Bir hata oluştu. Lütfen tekrar deneyin veya destekle iletişime geçin.',
      );
    }
  });

  bot.on('contact', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const pending = pendingLinks.get(fromId);
    if (!pending) {
      return ctx.reply(
        'Bekleyen bir bağlama isteği yok. Önce /link <kod> komutuyla bağlamayı başlatın.',
        removeKeyboard,
      );
    }

    if (pending.expiresAt <= Date.now()) {
      pendingLinks.delete(fromId);
      return ctx.reply(
        'Bağlama oturumunun süresi doldu. Lütfen yeni bir kod alın.',
        removeKeyboard,
      );
    }

    const contact = ctx.message.contact;

    // Telegram lets a user share *any* contact, not just their own. Reject
    // anything that isn't the sender's own contact card.
    if (contact.user_id !== fromId) {
      return ctx.reply(
        'Lütfen kendi telefonunuzu paylaşın (başkasının kişi kartını değil).',
        removeKeyboard,
      );
    }

    const sharedPhone = parsePhoneE164(contact.phone_number);
    if (!sharedPhone) {
      return ctx.reply(
        'Paylaştığınız telefon numarası okunamadı. Lütfen tekrar /link <kod> ile başlayın.',
        removeKeyboard,
      );
    }

    if (sharedPhone !== pending.expectedPhoneE164) {
      pendingLinks.delete(fromId);
      return ctx.reply(
        'Paylaştığınız telefon, hesabınızda kayıtlı telefonla eşleşmiyor. ' +
          'Hesap güvenliği için bağlama iptal edildi.',
        removeKeyboard,
      );
    }

    try {
      const telegramId = BigInt(fromId);
      await prisma.$transaction(async (tx) => {
        // Re-check token state inside the transaction — it could have been
        // consumed elsewhere in the window between /link and contact share.
        const t = await tx.telegramLinkToken.findUnique({
          where: { token: pending.token },
        });
        if (!t || t.usedAt || t.expiresAt < new Date()) {
          throw new Error('TOKEN_INVALID');
        }
        await tx.telegramLinkToken.update({
          where: { id: t.id },
          data: { usedAt: new Date() },
        });
        await tx.telegramAccount.upsert({
          where: { userId: pending.userId },
          create: {
            telegramId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            userId: pending.userId,
          },
          update: {
            telegramId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
          },
        });
      });
    } catch {
      pendingLinks.delete(fromId);
      return ctx.reply(
        'Bağlama tamamlanamadı: kod artık geçerli değil. Lütfen yeni bir kod alın.',
        removeKeyboard,
      );
    }

    pendingLinks.delete(fromId);
    return ctx.reply(
      'Hesap başarıyla bağlandı! ✅\n\nGörev hatırlatmalarını bu sohbette göndereceğim.',
      removeKeyboard,
    );
  });
}
