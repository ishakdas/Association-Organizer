import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, UserRole, PendingBranchStatus, Prisma } from '@ticketbot/database';
import {
  TelegramLinkRedeemInput,
  RequestBranchRegistrationInput,
} from '@ticketbot/shared-validation';
import * as jose from 'jose';
import { randomBytes } from 'crypto';
import { BOT_JWT_ISSUER } from './auth.constants';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { EmailService } from '../email/email.service';
import { PermissionService } from '../permissions/permission.service';

export interface InviteResult {
  emailSent: boolean;
  magicLink: string | null;
  messageId: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseAdminService,
    private readonly emailService: EmailService,
    private readonly permissions: PermissionService,
  ) {}

  async generateLinkToken(userId: string) {
    const token = randomBytes(28).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any prior unredeemed tokens for this user so only the
    // latest is valid — minimizes the attack window if an earlier token
    // leaked (logs, stale UI, copy/paste history, etc).
    await this.prisma.$transaction([
      this.prisma.telegramLinkToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.telegramLinkToken.create({
        data: { token, userId, expiresAt },
      }),
    ]);

    const botUsername = this.config.get<string>('telegramBotUsername') ?? 'dernek_organizer_bot';
    const deepLinkUrl = `https://t.me/${botUsername}?start=link_${token}`;

    return { token, expiresAt: expiresAt.toISOString(), deepLinkUrl };
  }

  async generateLinkTokenWithEmail(userId: string, email: string) {
    const { token, expiresAt } = await this.generateLinkToken(userId);

    const botUsername = this.config.get<string>('telegramBotUsername') ?? 'yedi_hilal_organizator_bot';
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';
    const deepLinkUrl = `https://t.me/${botUsername}?start=link_${token}`;
    const tgDirectUrl = `tg://resolve?domain=${botUsername}&start=link_${token}`;
    const connectUrl = `${webUrl}/connect-telegram?t=${token}`;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const emailResult = await this.emailService.sendTelegramLinkEmail(
      email,
      user?.fullName ?? email,
      botUsername,
      deepLinkUrl,
      tgDirectUrl,
      token,
      expiresAt,
      connectUrl,
    );

    return { token, expiresAt, deepLinkUrl, tgDirectUrl, connectUrl, emailSent: true, messageId: emailResult.messageId };
  }

  async redeemLinkToken(input: TelegramLinkRedeemInput) {
    const now = new Date();

    // Atomically claim the token: the WHERE clause only matches a token that
    // is still unused AND unexpired, so a single UPDATE both checks and marks
    // it used in one statement. Concurrent redemptions race on this row —
    // exactly one flips usedAt, the rest see count === 0. This closes the
    // check-then-act (TOCTOU) window of the previous findUnique-then-update.
    const claim = await this.prisma.telegramLinkToken.updateMany({
      where: { token: input.token, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (claim.count === 0) {
      // Disambiguate for a helpful (non-leaky) error message.
      const existing = await this.prisma.telegramLinkToken.findUnique({
        where: { token: input.token },
      });
      if (!existing) throw new BadRequestException('Invalid link token');
      if (existing.usedAt) throw new BadRequestException('Token already used');
      throw new BadRequestException('Token expired');
    }

    const linkToken = await this.prisma.telegramLinkToken.findUniqueOrThrow({
      where: { token: input.token },
    });

    // Create or update telegram account
    const telegramId = BigInt(input.telegramId);

    await this.prisma.telegramAccount.upsert({
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

    // Issue a bot JWT
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: linkToken.userId },
    });

    return this.issueBotToken(user.id, input.telegramId);
  }

  async unlinkTelegram(userId: string): Promise<{ unlinked: boolean }> {
    const result = await this.prisma.telegramAccount.deleteMany({
      where: { userId },
    });
    return { unlinked: result.count > 0 };
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

  async completeOnboarding(userId: string) {
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: now, mustChangePassword: false, activatedAt: now },
    });
    return { completedAt: now.toISOString() };
  }

  async clearTempPasswordFlag(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    });
  }

  async checkBranchEmail(email: string): Promise<{ status: string }> {
    const pending = await this.prisma.pendingBranchRegistration.findUnique({
      where: { email },
      select: { status: true },
    });

    if (pending) {
      if (pending.status === PendingBranchStatus.PENDING) return { status: 'pending' };
      if (pending.status === PendingBranchStatus.REJECTED) return { status: 'rejected' };
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, mustChangePassword: true },
    });
    if (existing) {
      if (existing.mustChangePassword) return { status: 'no_password' };
      return { status: 'active' };
    }

    return { status: 'unknown' };
  }

  async requestBranchRegistration(dto: RequestBranchRegistrationInput): Promise<{ queued: boolean }> {
    const existing = await this.prisma.pendingBranchRegistration.findUnique({
      where: { email: dto.email },
    });
    if (existing && existing.status === PendingBranchStatus.PENDING) {
      throw new ConflictException('Bu e-posta için zaten bekleyen bir başvuru var');
    }

    if (existing) {
      await this.prisma.pendingBranchRegistration.update({
        where: { email: dto.email },
        data: {
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          city: dto.city,
          district: dto.district,
          message: dto.message ?? null,
          status: PendingBranchStatus.PENDING,
          reviewedBy: null,
          reviewedAt: null,
        },
      });
    } else {
      await this.prisma.pendingBranchRegistration.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          city: dto.city,
          district: dto.district,
          message: dto.message ?? null,
        },
      });
    }

    return { queued: true };
  }

  async listPendingRegistrations() {
    return this.prisma.pendingBranchRegistration.findMany({
      where: { status: PendingBranchStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listApprovedRegistrations() {
    return this.prisma.pendingBranchRegistration.findMany({
      where: { status: PendingBranchStatus.APPROVED },
      orderBy: { reviewedAt: 'desc' },
      take: 50,
    });
  }

  async listRejectedRegistrations() {
    return this.prisma.pendingBranchRegistration.findMany({
      where: { status: PendingBranchStatus.REJECTED },
      orderBy: { reviewedAt: 'desc' },
      take: 50,
    });
  }

  async getEmailLogs(email: string) {
    return this.prisma.emailLog.findMany({
      where: { to: email },
      orderBy: { sentAt: 'desc' },
      take: 10,
      select: {
        id: true,
        templateKey: true,
        status: true,
        error: true,
        sentAt: true,
      },
    });
  }

  async resendInvite(id: string): Promise<InviteResult> {
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status !== PendingBranchStatus.APPROVED) {
      throw new BadRequestException('Bu başvuru onaylanmamış');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: registration.email },
      select: { mustChangePassword: true },
    });
    if (existingUser && !existingUser.mustChangePassword) {
      throw new BadRequestException('Bu kullanıcı zaten şifresini belirlemiş, tekrar davet gönderilemez.');
    }

    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';
    const redirectTo = `${webUrl}/callback-magic?next=/onboarding`;

    const { url: magicLink } = await this.supabase.generateMagicLink(
      registration.email,
      redirectTo,
    );

    const emailResult = await this.emailService.sendMagicLink(
      registration.email,
      registration.fullName,
      magicLink,
    );

    return { emailSent: true, magicLink, messageId: emailResult.messageId };
  }

  async resendInviteForUser(userId: string): Promise<InviteResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, mustChangePassword: true },
    });
    if (!user || !user.email) throw new NotFoundException('Kullanıcı bulunamadı');
    if (!user.mustChangePassword) {
      throw new BadRequestException('Kullanıcı zaten şifresini belirlemiş');
    }

    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';
    const redirectTo = `${webUrl}/callback-magic?next=/onboarding`;

    const { url: magicLink } = await this.supabase.generateMagicLink(
      user.email,
      redirectTo,
    );

    const emailResult = await this.emailService.sendMagicLink(
      user.email,
      user.fullName,
      magicLink,
    );

    return { emailSent: true, magicLink, messageId: emailResult.messageId };
  }

  async approveBranchRegistration(
    id: string,
    adminUserId: string,
  ): Promise<InviteResult> {
    // --- Pre-checks (before any Supabase call so no email is sent on error) ---
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status === PendingBranchStatus.APPROVED) {
      throw new BadRequestException('Bu başvuru zaten onaylanmış');
    }

    // Check for duplicate branch (same city + district already approved)
    const existingBranch = await this.prisma.association.findFirst({
      where: {
        city: registration.city,
        district: registration.district,
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, supabaseUserId: true, activatedAt: true } },
      },
    });

    if (existingBranch) {
      if (existingBranch.createdBy?.activatedAt) {
        throw new ConflictException(
          `${registration.city} / ${registration.district} şubesi zaten sistemde kayıtlı.`,
        );
      }

      this.logger.log(
        `Orphaned branch cleanup: "${existingBranch.name}" (${existingBranch.id}) — creator never activated`,
      );
      await this.cleanupOrphanedBranch(existingBranch);
    }

    // --- Create Supabase user (does NOT send email) ---
    const auth = this.supabase.getAuthClient();
    const { data: userData, error: createError } = await auth.createUser({
      email: registration.email,
      email_confirm: true,
      user_metadata: { full_name: registration.fullName },
    });
    if (createError || !userData?.user) {
      throw new BadRequestException(
        `Kullanıcı oluşturulamadı: ${createError?.message ?? 'Bilinmeyen hata'}`,
      );
    }
    const supabaseUserId = userData.user.id;

    // --- Generate magic link ---
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';
    const redirectTo = `${webUrl}/callback-magic?next=/onboarding`;

    let magicLink: string | null = null;
    try {
      const linkResult = await this.supabase.generateMagicLink(
        registration.email,
        redirectTo,
      );
      magicLink = linkResult.url;
    } catch (linkErr) {
      this.logger.warn(
        `Magic link oluşturulamadı (${registration.email}): ${(linkErr as Error).message}`,
      );
    }

    // --- Send email via Resend (or fallback) ---
    let messageId: string | null = null;
    if (magicLink) {
      const emailResult = await this.emailService.sendMagicLink(
        registration.email,
        registration.fullName,
        magicLink,
      );
      messageId = emailResult.messageId;
    }

    // --- Persist: create branch Association + User + Membership ---
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.pendingBranchRegistration.update({
          where: { id },
          data: {
            status: PendingBranchStatus.APPROVED,
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        });

        const user = await tx.user.upsert({
          where: { email: registration.email },
          update: { supabaseUserId, fullName: registration.fullName, mustChangePassword: true },
          create: {
            supabaseUserId,
            email: registration.email,
            fullName: registration.fullName,
            phone: registration.phone ?? null,
            isActive: true,
            mustChangePassword: true,
          },
        });

        const branchName = `${registration.city} - ${registration.district} Şubesi`;
        const newAssociation = await tx.association.create({
          data: {
            name: branchName,
            city: registration.city,
            district: registration.district,
            email: registration.email,
            foundedAt: new Date(),
            activityArea: 'Genel',
            createdById: user.id,
            isActive: true,
          },
        });

        await tx.associationMembership.create({
          data: {
            userId: user.id,
            associationId: newAssociation.id,
            role: UserRole.ASSOCIATION_MANAGER,
            isActive: true,
          },
        });

        await this.permissions.applyMembershipDefaults(
          newAssociation.id,
          user.id,
          tx,
        );
      });
    } catch (err) {
      try {
        await auth.deleteUser(supabaseUserId);
      } catch (rollbackErr) {
        this.logger.error(
          `Supabase rollback failed for ${supabaseUserId}: ${
            (rollbackErr as Error).message
          }`,
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu şube için zaten bir kayıt mevcut.');
      }
      throw err;
    }

    return { emailSent: true, magicLink, messageId };
  }

  async rejectBranchRegistration(id: string, adminUserId: string): Promise<void> {
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status !== PendingBranchStatus.PENDING) {
      throw new BadRequestException('Bu başvuru zaten işleme alınmış');
    }

    await this.prisma.pendingBranchRegistration.update({
      where: { id },
      data: {
        status: PendingBranchStatus.REJECTED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Removes an orphaned branch association and its creator user from both
   * Supabase Auth and the local database. Used when a branch was approved
   * but the creator never completed onboarding (activatedAt is null).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async cleanupOrphanedBranch(association: any): Promise<void> {
    const user = association.createdBy;
    if (user?.supabaseUserId) {
      try {
        await this.supabase.getAuthClient().deleteUser(user.supabaseUserId);
      } catch (err) {
        this.logger.warn(
          `Supabase cleanup failed for orphaned branch ${association.id}: ${(err as Error).message}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (user?.id) {
        await tx.telegramAccount.deleteMany({ where: { userId: user.id } });
        await tx.associationMembership.deleteMany({ where: { associationId: association.id } });
        await tx.user.delete({ where: { id: user.id } });
      }
      await tx.task.deleteMany({ where: { associationId: association.id } });
      await tx.meetingNote.deleteMany({ where: { associationId: association.id } });
      await tx.event.deleteMany({ where: { associationId: association.id } });
      await tx.association.delete({ where: { id: association.id } });
    });
  }

}
