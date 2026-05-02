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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseAdminService,
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
      data: { onboardingCompletedAt: now, mustChangePassword: false },
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

  async resendInvite(id: string): Promise<{ sent: boolean }> {
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

    const auth = this.supabase.getAuthClient();
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';

    const { error } = await auth.inviteUserByEmail(registration.email, {
      data: { full_name: registration.fullName },
      redirectTo: `${webUrl}/callback-magic?next=/onboarding`,
    });
    if (error) {
      this.logger.error(`Supabase davet gönderilemedi (${registration.email}): ${error.message}`);
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already been registered')) {
        throw new BadRequestException('Bu kullanıcı Supabase\'de zaten kayıtlı ve şifresini belirlemiş. Davet gönderilmesine gerek yok.');
      }
      throw new BadRequestException(`Davet gönderilemedi: ${error.message}`);
    }
    return { sent: true };
  }

  async resendInviteForUser(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, mustChangePassword: true },
    });
    if (!user || !user.email) throw new NotFoundException('Kullanıcı bulunamadı');
    if (!user.mustChangePassword) {
      throw new BadRequestException('Kullanıcı zaten şifresini belirlemiş');
    }

    const auth = this.supabase.getAuthClient();
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';

    const { error } = await auth.inviteUserByEmail(user.email, {
      data: { full_name: user.fullName },
      redirectTo: `${webUrl}/callback-magic?next=/onboarding`,
    });
    if (error) {
      this.logger.error(`Supabase davet gönderilemedi (${user.email}): ${error.message}`);
      throw new BadRequestException(`Davet gönderilemedi: ${error.message}`);
    }
    return { sent: true };
  }

  async approveBranchRegistration(
    id: string,
    adminUserId: string,
  ): Promise<{}> {
    // --- Pre-checks (before any Supabase call so no email is sent on error) ---
    const registration = await this.prisma.pendingBranchRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('Başvuru bulunamadı');
    if (registration.status !== PendingBranchStatus.PENDING) {
      throw new BadRequestException('Bu başvuru zaten işleme alınmış');
    }

    // Check for duplicate branch (same city + district already approved)
    const duplicateBranch = await this.prisma.association.findFirst({
      where: {
        city: registration.city,
        district: registration.district,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (duplicateBranch) {
      throw new ConflictException(
        `${registration.city} / ${registration.district} şubesi zaten sistemde kayıtlı.`,
      );
    }

    // --- Send Supabase invite email (creates user + sends magic link) ---
    const auth = this.supabase.getAuthClient();
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3001';

    const { data: inviteData, error: inviteError } = await auth.inviteUserByEmail(
      registration.email,
      {
        data: { full_name: registration.fullName },
        redirectTo: `${webUrl}/callback-magic?next=/onboarding`,
      },
    );
    if (inviteError) {
      throw new BadRequestException(`Davet gönderilemedi: ${inviteError.message}`);
    }
    const supabaseUserId = inviteData.user.id;

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

        // Create a new Association representing this branch
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
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu şube için zaten bir kayıt mevcut.');
      }
      throw err;
    }

    return {};
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

}
