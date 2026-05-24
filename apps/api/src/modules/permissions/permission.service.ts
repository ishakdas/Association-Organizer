import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, PermissionAction, Prisma, UserRole } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

export interface UserPermissionSummary {
  userId: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  permissions: PermissionAction[];
}

// Title slug → auto-granted permission. Slugs are produced by slugifyTr
// during seed and stored on MemberTitleDefinition.slug.
const TITLE_DERIVED_PERMISSIONS: Record<string, PermissionAction> = {
  'teskilat-baskani': PermissionAction.USE_MEETING_COMMANDS,
  'mali-isler-sorumlusu': PermissionAction.USE_FINANCE_COMMANDS,
};

type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  // Granted to every new active membership so /gorevlerim is callable
  // without an explicit manager grant.
  async applyMembershipDefaults(
    associationId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client: PrismaLike = tx ?? this.prisma;
    await client.permission.createMany({
      data: [
        { associationId, userId, action: PermissionAction.USE_TASK_COMMANDS },
      ],
      skipDuplicates: true,
    });
  }

  // Inserts permissions implied by the member's titles (e.g. Mali İşler
  // Sorumlusu → USE_FINANCE_COMMANDS). Idempotent — never revokes; the
  // manager can manually revoke from the permissions UI.
  async applyTitleDerivedPermissions(
    associationId: string,
    userId: string,
    titleIds: (string | null | undefined)[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const ids = titleIds.filter((id): id is string => !!id);
    if (ids.length === 0) return;

    const client: PrismaLike = tx ?? this.prisma;
    const titles = await client.memberTitleDefinition.findMany({
      where: { id: { in: ids } },
      select: { slug: true },
    });

    const actions = new Set<PermissionAction>();
    for (const t of titles) {
      const action = TITLE_DERIVED_PERMISSIONS[t.slug];
      if (action) actions.add(action);
    }
    if (actions.size === 0) return;

    await client.permission.createMany({
      data: Array.from(actions).map((action) => ({
        associationId,
        userId,
        action,
      })),
      skipDuplicates: true,
    });
  }

  async hasPermission(
    userId: string,
    associationId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: {
        associationId,
        userId,
        action,
      },
    });
    return count > 0;
  }

  async hasAnyPermission(
    userId: string,
    associationId: string,
    actions: PermissionAction[],
  ): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: {
        associationId,
        userId,
        action: { in: actions },
      },
    });
    return count > 0;
  }

  async assertPermission(
    user: AuthenticatedUser,
    associationId: string,
    action: PermissionAction,
  ): Promise<void> {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return;

    const membership = user.memberships.find(
      (m) => m.isActive && m.associationId === associationId,
    );
    if (!membership) {
      throw new ForbiddenException('Bu dernek için üyeliğiniz yok');
    }

    if (membership.role === UserRole.ASSOCIATION_MANAGER) return;

    const has = await this.hasPermission(user.id, associationId, action);
    if (!has) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }
  }

  async getUserPermissions(
    associationId: string,
    userId: string,
  ): Promise<PermissionAction[]> {
    const rows = await this.prisma.permission.findMany({
      where: { associationId, userId },
      select: { action: true },
    });
    return rows.map((r) => r.action);
  }

  async getAssociationPermissionSummary(
    associationId: string,
  ): Promise<UserPermissionSummary[]> {
    const memberships = await this.prisma.associationMembership.findMany({
      where: {
        associationId,
        isActive: true,
        deletedAt: null,
        role: { not: UserRole.ASSOCIATION_MANAGER },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    const permissions = await this.prisma.permission.findMany({
      where: { associationId },
      select: { userId: true, action: true },
    });

    const permissionMap = new Map<string, PermissionAction[]>();
    for (const p of permissions) {
      const existing = permissionMap.get(p.userId) ?? [];
      existing.push(p.action);
      permissionMap.set(p.userId, existing);
    }

    return memberships.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      role: m.role,
      permissions: permissionMap.get(m.userId) ?? [],
    }));
  }

  async grantPermission(
    associationId: string,
    userId: string,
    action: PermissionAction,
    grantedBy: AuthenticatedUser,
  ) {
    if (grantedBy.systemRole !== UserRole.SYSTEM_ADMIN) {
      const isManager = grantedBy.memberships.some(
        (m) =>
          m.isActive &&
          m.associationId === associationId &&
          m.role === UserRole.ASSOCIATION_MANAGER,
      );
      if (!isManager) {
        throw new ForbiddenException('Bu işlem için yönetici yetkisi gerekli');
      }
    }

    const targetMembership = await this.prisma.associationMembership.findFirst({
      where: {
        userId,
        associationId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!targetMembership) {
      throw new BadRequestException('Kullanıcı bu derneğin aktif üyesi değil');
    }

    const existing = await this.prisma.permission.findUnique({
      where: {
        associationId_userId_action: {
          associationId,
          userId,
          action,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Bu yetki zaten verilmiş');
    }

    return this.prisma.permission.create({
      data: {
        associationId,
        userId,
        action,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });
  }

  async revokePermission(
    associationId: string,
    userId: string,
    action: PermissionAction,
    revokedBy: AuthenticatedUser,
  ) {
    if (revokedBy.systemRole !== UserRole.SYSTEM_ADMIN) {
      const isManager = revokedBy.memberships.some(
        (m) =>
          m.isActive &&
          m.associationId === associationId &&
          m.role === UserRole.ASSOCIATION_MANAGER,
      );
      if (!isManager) {
        throw new ForbiddenException('Bu işlem için yönetici yetkisi gerekli');
      }
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        associationId_userId_action: {
          associationId,
          userId,
          action,
        },
      },
    });
    if (!permission) throw new NotFoundException('Yetki bulunamadı');

    return this.prisma.permission.delete({
      where: {
        associationId_userId_action: {
          associationId,
          userId,
          action,
        },
      },
    });
  }

  async bulkGrantPermission(
    associationId: string,
    userId: string,
    actions: PermissionAction[],
    grantedBy: AuthenticatedUser,
  ) {
    const results: { action: PermissionAction; created: boolean }[] = [];

    for (const action of actions) {
      try {
        await this.grantPermission(associationId, userId, action, grantedBy);
        results.push({ action, created: true });
      } catch (error) {
        if (error instanceof BadRequestException) {
          results.push({ action, created: false });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  async bulkRevokePermission(
    associationId: string,
    userId: string,
    actions: PermissionAction[],
    revokedBy: AuthenticatedUser,
  ) {
    const results: { action: PermissionAction; revoked: boolean }[] = [];

    for (const action of actions) {
      try {
        await this.revokePermission(associationId, userId, action, revokedBy);
        results.push({ action, revoked: true });
      } catch (error) {
        if (error instanceof NotFoundException) {
          results.push({ action, revoked: false });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  async syncPermissions(
    associationId: string,
    userId: string,
    desiredActions: PermissionAction[],
    grantedBy: AuthenticatedUser,
  ) {
    const current = await this.getUserPermissions(associationId, userId);

    const toRevoke = current.filter((a) => !desiredActions.includes(a));
    const toGrant = desiredActions.filter((a) => !current.includes(a));

    for (const action of toRevoke) {
      await this.revokePermission(associationId, userId, action, grantedBy);
    }

    for (const action of toGrant) {
      await this.grantPermission(associationId, userId, action, grantedBy);
    }

    return { granted: toGrant, revoked: toRevoke };
  }
}
