import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole } from '@ticketbot/database';
import type {
  AdminAssociationResponse,
  AdminLinkTokenResponse,
  AdminUserResponse,
  ListAdminAssociationsQuery,
  ListAdminUsersQuery,
  UpdateProfileInput,
} from '@ticketbot/shared-validation';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const data: { fullName?: string; phone?: string | null } = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone ?? null;
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async listUsers(
    query: ListAdminUsersQuery,
  ): Promise<{
    data: AdminUserResponse[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const where = {
      deletedAt: null as Date | null,
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { phone: { contains: query.search } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          memberships: {
            where: {
              role: UserRole.SYSTEM_ADMIN,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        supabaseUserId: u.supabaseUserId,
        isActive: u.isActive,
        isSystemAdmin: u.memberships.length > 0,
        createdAt: u.createdAt.toISOString(),
      })),
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async listSystemAdmins(): Promise<AdminUserResponse[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        memberships: {
          some: {
            role: UserRole.SYSTEM_ADMIN,
            isActive: true,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      supabaseUserId: u.supabaseUserId,
      isActive: u.isActive,
      isSystemAdmin: true,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async promoteToSystemAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Kullanıcı bulunamadı');

    const rootId = await this.resolveSystemRootAssociationId();

    const existing = await this.prisma.associationMembership.findUnique({
      where: {
        userId_associationId_role: {
          userId,
          associationId: rootId,
          role: UserRole.SYSTEM_ADMIN,
        },
      },
    });

    if (existing && existing.isActive && !existing.deletedAt) {
      return { promoted: false, alreadyAdmin: true };
    }

    await this.prisma.associationMembership.upsert({
      where: {
        userId_associationId_role: {
          userId,
          associationId: rootId,
          role: UserRole.SYSTEM_ADMIN,
        },
      },
      update: { isActive: true, deletedAt: null },
      create: {
        userId,
        associationId: rootId,
        role: UserRole.SYSTEM_ADMIN,
        isActive: true,
      },
    });
    return { promoted: true, alreadyAdmin: false };
  }

  async revokeSystemAdmin(userId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new BadRequestException(
        'Kendi sistem yöneticiliğinizi kaldıramazsınız',
      );
    }

    const activeAdmins = await this.prisma.associationMembership.count({
      where: {
        role: UserRole.SYSTEM_ADMIN,
        isActive: true,
        deletedAt: null,
      },
    });

    if (activeAdmins <= 1) {
      throw new ConflictException(
        'Son sistem yöneticisi kaldırılamaz — en az bir yönetici kalmalı',
      );
    }

    const result = await this.prisma.associationMembership.updateMany({
      where: {
        userId,
        role: UserRole.SYSTEM_ADMIN,
        isActive: true,
        deletedAt: null,
      },
      data: { isActive: false, deletedAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Bu kullanıcı zaten sistem yöneticisi değil',
      );
    }
    return { revoked: true };
  }

  async listAssociationsAdmin(
    query: ListAdminAssociationsQuery,
  ): Promise<{
    data: AdminAssociationResponse[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const includeDeleted = query.includeDeleted === true;
    const rootId = await this.resolveSystemRootAssociationId().catch(() => null);

    const where = {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(rootId && { id: { not: rootId } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { taxNumber: { contains: query.search } },
          { city: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.association.findMany({
        where,
        orderBy: [{ deletedAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.association.count({ where }),
    ]);

    return {
      data: rows.map((a) => ({
        id: a.id,
        name: a.name,
        shortName: a.shortName,
        taxNumber: a.taxNumber,
        city: a.city,
        district: a.district,
        isActive: a.isActive,
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      })),
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async softDeleteAssociation(id: string) {
    const rootId = await this.resolveSystemRootAssociationId().catch(() => null);
    if (rootId && id === rootId) {
      throw new BadRequestException('Sistem kökü silinemez');
    }
    const association = await this.prisma.association.findUnique({ where: { id } });
    if (!association) throw new NotFoundException('Dernek bulunamadı');
    if (association.deletedAt) {
      throw new ConflictException('Dernek zaten silinmiş');
    }
    return this.prisma.association.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async restoreAssociation(id: string) {
    const association = await this.prisma.association.findUnique({ where: { id } });
    if (!association) throw new NotFoundException('Dernek bulunamadı');
    if (!association.deletedAt) {
      throw new ConflictException('Dernek zaten aktif');
    }
    return this.prisma.association.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    });
  }

  async listLinkTokens(): Promise<AdminLinkTokenResponse[]> {
    const rows = await this.prisma.telegramLinkToken.findMany({
      where: { usedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true },
    });
    const usersById = new Map(users.map((u) => [u.id, u]));
    const now = Date.now();

    return rows.map((r) => {
      const user = usersById.get(r.userId);
      return {
        id: r.id,
        token: r.token,
        userId: r.userId,
        userFullName: user?.fullName ?? '—',
        userEmail: user?.email ?? null,
        expiresAt: r.expiresAt.toISOString(),
        usedAt: r.usedAt ? r.usedAt.toISOString() : null,
        isExpired: r.expiresAt.getTime() < now,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async deleteLinkToken(id: string) {
    const exists = await this.prisma.telegramLinkToken.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Bağlantı kodu bulunamadı');
    await this.prisma.telegramLinkToken.delete({ where: { id } });
    return { deleted: true };
  }

  private async resolveSystemRootAssociationId(): Promise<string> {
    const existing = await this.prisma.associationMembership.findFirst({
      where: { role: UserRole.SYSTEM_ADMIN },
      select: { associationId: true },
    });
    if (existing) return existing.associationId;
    throw new NotFoundException(
      'Sistem kökü dernek kaydı bulunamadı — `pnpm db:seed` çalıştırın',
    );
  }
}
