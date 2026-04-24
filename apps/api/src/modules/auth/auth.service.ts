import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ticketbot/database';
import { TelegramLinkRedeemInput } from '@ticketbot/shared-validation';
import * as jose from 'jose';
import { randomBytes } from 'crypto';
import { BOT_JWT_ISSUER } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateLinkToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.telegramLinkToken.create({
      data: { token, userId, expiresAt },
    });

    return { token, expiresAt: expiresAt.toISOString() };
  }

  async redeemLinkToken(input: TelegramLinkRedeemInput) {
    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { token: input.token },
    });

    if (!linkToken) {
      throw new BadRequestException('Invalid link token');
    }

    if (linkToken.usedAt) {
      throw new BadRequestException('Token already used');
    }

    if (linkToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    // Create or update telegram account
    const telegramId = BigInt(input.telegramId);

    await this.prisma.$transaction(async (tx) => {
      await tx.telegramLinkToken.update({
        where: { id: linkToken.id },
        data: { usedAt: new Date() },
      });

      await tx.telegramAccount.upsert({
        where: { userId: linkToken.userId },
        create: {
          telegramId,
          username: input.username,
          firstName: input.firstName,
          userId: linkToken.userId,
        },
        update: {
          telegramId,
          username: input.username,
          firstName: input.firstName,
        },
      });
    });

    // Issue a bot JWT
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: linkToken.userId },
    });

    return this.issueBotToken(user.id, input.telegramId);
  }

  async issueBotToken(userId: string, telegramId: string) {
    const secret = new TextEncoder().encode(this.config.get<string>('jwt.secret')!);

    const token = await new jose.SignJWT({ telegramId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(BOT_JWT_ISSUER)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    return { accessToken: token };
  }
}
