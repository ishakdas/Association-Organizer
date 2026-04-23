import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService, Role } from '@ticketbot/database';
import {
  CreateOrganisationInput,
  UpdateOrganisationInput,
  AddMemberInput,
  UpdateMemberRoleInput,
} from '@ticketbot/shared-validation';

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrganisationInput, creatorId: string) {
    const existing = await this.prisma.organisation.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new ConflictException('Bu slug zaten kullanılıyor');
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: { name: input.name, slug: input.slug },
      });
      await tx.membership.create({
        data: {
          organisationId: org.id,
          userId: creatorId,
          role: Role.ADMIN,
        },
      });
      return org;
    });
  }

  async listMine(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { organisation: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(organisationId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        _count: { select: { memberships: true, tickets: true } },
      },
    });
    if (!org) throw new NotFoundException('Dernek bulunamadı');
    return org;
  }

  async update(organisationId: string, input: UpdateOrganisationInput) {
    if (input.slug) {
      const clash = await this.prisma.organisation.findFirst({
        where: { slug: input.slug, NOT: { id: organisationId } },
      });
      if (clash) throw new ConflictException('Bu slug zaten kullanılıyor');
    }

    try {
      return await this.prisma.organisation.update({
        where: { id: organisationId },
        data: input,
      });
    } catch {
      throw new NotFoundException('Dernek bulunamadı');
    }
  }

  async listMembers(organisationId: string) {
    return this.prisma.membership.findMany({
      where: { organisationId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(organisationId: string, input: AddMemberInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new NotFoundException(
        'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı. Önce sisteme giriş yapmış olmalıdır.',
      );
    }

    const already = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: { organisationId, userId: user.id },
      },
    });
    if (already) {
      throw new ConflictException('Bu kullanıcı zaten üye');
    }

    return this.prisma.membership.create({
      data: {
        organisationId,
        userId: user.id,
        role: input.role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async updateMemberRole(
    organisationId: string,
    targetUserId: string,
    input: UpdateMemberRoleInput,
  ) {
    const target = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: { organisationId, userId: targetUserId },
      },
    });
    if (!target) throw new NotFoundException('Üye bulunamadı');

    if (target.role === Role.ADMIN && input.role !== Role.ADMIN) {
      await this.assertOtherAdminExists(organisationId, targetUserId);
    }

    return this.prisma.membership.update({
      where: { id: target.id },
      data: { role: input.role },
    });
  }

  async removeMember(
    organisationId: string,
    targetUserId: string,
    actorUserId: string,
  ) {
    const target = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: { organisationId, userId: targetUserId },
      },
    });
    if (!target) throw new NotFoundException('Üye bulunamadı');

    if (target.userId === actorUserId && target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Yönetici kendi üyeliğini silemez. Önce başka bir yönetici atayın.',
      );
    }

    if (target.role === Role.ADMIN) {
      await this.assertOtherAdminExists(organisationId, targetUserId);
    }

    return this.prisma.membership.delete({ where: { id: target.id } });
  }

  private async assertOtherAdminExists(organisationId: string, excludedUserId: string) {
    const otherAdmins = await this.prisma.membership.count({
      where: {
        organisationId,
        role: Role.ADMIN,
        NOT: { userId: excludedUserId },
      },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException(
        'Son yöneticiyi kaldıramazsınız. Önce başka bir yönetici atayın.',
      );
    }
  }
}
