import { Telegraf } from 'telegraf';
import { PrismaService } from '@ticketbot/database';
import { ConfigService } from '@nestjs/config';

export function registerLinkCommand(
  bot: Telegraf,
  prisma: PrismaService,
  config: ConfigService,
) {
  bot.command('link', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const token = args[0];

    if (!token) {
      return ctx.reply('Usage: /link <token>\n\nGet a token from the web dashboard.');
    }

    try {
      // Call the API's redeem endpoint internally via the database
      const linkToken = await prisma.telegramLinkToken.findUnique({
        where: { token },
      });

      if (!linkToken) {
        return ctx.reply('Invalid token. Please generate a new one from the dashboard.');
      }

      if (linkToken.usedAt) {
        return ctx.reply('This token has already been used. Please generate a new one.');
      }

      if (linkToken.expiresAt < new Date()) {
        return ctx.reply('This token has expired. Please generate a new one.');
      }

      const telegramId = BigInt(ctx.from.id);

      await prisma.$transaction(async (tx) => {
        await tx.telegramLinkToken.update({
          where: { id: linkToken.id },
          data: { usedAt: new Date() },
        });

        await tx.telegramAccount.upsert({
          where: { userId: linkToken.userId },
          create: {
            telegramId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            userId: linkToken.userId,
          },
          update: {
            telegramId,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
          },
        });
      });

      return ctx.reply(
        'Account linked successfully! ✅\n\n' +
          "You'll now receive ticket notifications here.",
      );
    } catch (error) {
      return ctx.reply('Something went wrong. Please try again or contact support.');
    }
  });
}
