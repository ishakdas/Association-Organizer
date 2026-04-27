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
  ApproveBranchRegistrationInput,
} from '@ticketbot/shared-validation';
import * as jose from 'jose';
import { randomBytes } from 'crypto';
import { BOT_JWT_ISSUER } from './auth.constants';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseAdminService,
    private readonly email: EmailService,
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
      data: { onboardingCompletedAt: now },
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
      select: { id: true },
    });
    if (existing) return { status: 'active' };

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

  async resendInvite(id: string): Promise<{ sent: boolean }> {
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status !== PendingBranchStatus.APPROVED) {
      throw new BadRequestException('Bu başvuru onaylanmamış');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: registration.email },
      select: { supabaseUserId: true },
    });
    if (!user?.supabaseUserId) return { sent: false };

    const tempPassword = this.generateTempPassword();
    const auth = this.supabase.getAuthClient();

    const { error } = await auth.updateUserById(user.supabaseUserId, {
      password: tempPassword,
    });
    if (error) {
      this.logger.error(`Supabase şifre güncellenemedi (${registration.email}): ${error.message}`);
      return { sent: false };
    }

    await this.prisma.user.update({
      where: { email: registration.email },
      data: { mustChangePassword: true },
    });

    await this.email.sendTempPassword(registration.email, registration.fullName, tempPassword);
    return { sent: true };
  }

  async approveBranchRegistration(
    id: string,
    adminUserId: string,
    dto: ApproveBranchRegistrationInput,
  ): Promise<void> {
    // --- Pre-checks (before any Supabase call so no email is sent on error) ---
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status !== PendingBranchStatus.PENDING) {
      throw new BadRequestException('Bu başvuru zaten işleme alınmış');
    }

    const association = await this.prisma.association.findFirst({
      where: { id: dto.associationId, deletedAt: null },
      select: { id: true },
    });
    if (!association) throw new NotFoundException('Dernek bulunamadı');

    if (dto.role === UserRole.ASSOCIATION_MANAGER) {
      const existingManager = await this.prisma.associationMembership.findFirst({
        where: { associationId: dto.associationId, role: UserRole.ASSOCIATION_MANAGER, deletedAt: null },
      });
      if (existingManager) {
        throw new ConflictException('Bu dernekte zaten aktif bir Başkan bulunuyor. Lütfen farklı bir rol seçin.');
      }
    }

    // --- Generate temp password ---
    const tempPassword = this.generateTempPassword();

    // --- Get or create confirmed Supabase user ---
    const auth = this.supabase.getAuthClient();

    let supabaseUserId: string;
    const existingDbUser = await this.prisma.user.findFirst({
      where: { email: registration.email },
      select: { supabaseUserId: true },
    });

    if (existingDbUser?.supabaseUserId) {
      supabaseUserId = existingDbUser.supabaseUserId;
      // Update password for existing Supabase user
      await auth.updateUserById(supabaseUserId, { password: tempPassword });
    } else {
      const { data: userData, error: createError } = await auth.createUser({
        email: registration.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: registration.fullName },
      });
      if (createError) {
        throw new BadRequestException(`Kullanıcı oluşturulamadı: ${createError.message}`);
      }
      supabaseUserId = userData.user.id;
    }

    // --- Persist ---
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

        const existingMembership = await tx.associationMembership.findFirst({
          where: { userId: user.id, associationId: dto.associationId, deletedAt: null },
        });
        if (!existingMembership) {
          await tx.associationMembership.create({
            data: {
              userId: user.id,
              associationId: dto.associationId,
              role: dto.role as UserRole,
              isActive: true,
            },
          });
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'Bu dernekte zaten aktif bir Başkan bulunuyor. Lütfen farklı bir rol seçin.',
        );
      }
      throw err;
    }

    // --- Send temp password email ---
    await this.email.sendTempPassword(registration.email, registration.fullName, tempPassword);
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private generateTempPassword(): string {
    return randomBytes(8).toString('base64url');
  }
}
