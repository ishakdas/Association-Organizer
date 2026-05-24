import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  Prisma,
  UserRole,
  type User,
} from '@ticketbot/database';
import {
  AddMemberInput,
  ListMembersQuery,
  UpdateMemberInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from '../permissions/permission.service';

export const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      address: true,
      mustChangePassword: true,
      telegramAccount: {
        select: { username: true, firstName: true, createdAt: true },
      },
    },
  },
  titleAssignments: {
    include: {
      title: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
} as const;

@Injectable()
export class AssociationMembersService {
  private readonly logger = new Logger(AssociationMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly permissions: PermissionService,
  ) {}

  async create(associationId: string, input: AddMemberInput) {
    await this.ensureAssociation(associationId);

    if (input.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, supabaseUserId: true, isActive: true },
      });

      if (existing) {
        if (!existing.isActive) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { isActive: true },
          });
        }

        try {
          const membership = await this.prisma.associationMembership.create({
            data: {
              associationId,
              userId: existing.id,
              role: input.role,
              titleAssignments: {
                create: this.normalizeTitleAssignments(input.titleAssignments),
              },
              isActive: true,
            },
            include: MEMBER_INCLUDE,
          });
          await this.applyMemberPermissions(
            associationId,
            existing.id,
            input.titleAssignments,
          );
          return membership;
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            throw new ConflictException(
              'Bu üye bu dernekte zaten kayıtlı',
            );
          }
          throw e;
        }
      }
    }

    const provisionsSupabase =
      input.role === 'ASSOCIATION_SECRETARY' && !!input.password;

    let createdUser: User | null = null;
    try {
      createdUser = provisionsSupabase
        ? await this.users.createSupabaseUser({
            email: input.email!,
            password: input.password!,
            fullName: input.fullName,
            phone: input.phone,
            address: input.address,
          })
        : await this.users.createDbOnlyUser({
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            address: input.address,
          });

      const membership = await this.prisma.associationMembership.create({
        data: {
          associationId,
          userId: createdUser.id,
          role: input.role,
          titleAssignments: {
            create: this.normalizeTitleAssignments(input.titleAssignments),
          },
          isActive: true,
        },
        include: MEMBER_INCLUDE,
      });
      await this.applyMemberPermissions(
        associationId,
        createdUser.id,
        input.titleAssignments,
      );
      return membership;
    } catch (e) {
      if (createdUser) {
        try {
          await this.users.deleteUser({
            id: createdUser.id,
            supabaseUserId: createdUser.supabaseUserId,
          });
        } catch (rollbackErr) {
          this.logger.error(
            `Saga rollback failed for user ${createdUser.id}: ${
              (rollbackErr as Error).message
            }`,
          );
        }
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu dernek için belirtilen rol zaten aktif bir kişiye atanmış',
        );
      }
      throw e;
    }
  }

  async list(associationId: string, query: ListMembersQuery) {
    await this.ensureAssociation(associationId);

    const where: Prisma.AssociationMembershipWhereInput = {
      associationId,
      deletedAt: null,
    };

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== false) {
      where.isActive = true;
      where.leftAt = null;
    }

    return this.prisma.associationMembership.findMany({
      where,
      include: MEMBER_INCLUDE,
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async update(
    associationId: string,
    membershipId: string,
    input: UpdateMemberInput,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.ensureMembership(associationId, membershipId);

    const touchesManager =
      existing.role === UserRole.ASSOCIATION_MANAGER ||
      input.role === UserRole.ASSOCIATION_MANAGER;
    if (touchesManager && actor.systemRole !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Başkanlık rolünü yalnızca sistem yöneticisi değiştirebilir',
      );
    }

    const data: Prisma.AssociationMembershipUpdateInput = {};
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.leftAt !== undefined) {
      data.leftAt = input.leftAt ? new Date(input.leftAt) : null;
    }
    if (input.titleAssignments !== undefined) {
      data.titleAssignments = {
        deleteMany: {},
        create: this.normalizeTitleAssignments(input.titleAssignments),
      };
    }

    const userData: Prisma.UserUpdateInput = {};
    if (input.fullName !== undefined) userData.fullName = input.fullName;
    if (input.email !== undefined) userData.email = input.email;
    if (input.phone !== undefined) userData.phone = input.phone ?? null;
    if (input.address !== undefined) userData.address = input.address;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userData,
          });
        }
        return tx.associationMembership.update({
          where: { id: membershipId },
          data,
          include: MEMBER_INCLUDE,
        });
      });

      if (input.titleAssignments !== undefined) {
        await this.permissions.applyTitleDerivedPermissions(
          associationId,
          existing.userId,
          input.titleAssignments.map((a) => a.titleId ?? null),
        );
      }

      return result;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu dernek için belirtilen rol zaten aktif bir kişiye atanmış',
        );
      }
      throw e;
    }
  }

  async remove(
    associationId: string,
    membershipId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.ensureMembership(associationId, membershipId);

    if (
      existing.role === UserRole.ASSOCIATION_MANAGER &&
      actor.systemRole !== UserRole.SYSTEM_ADMIN
    ) {
      throw new ForbiddenException(
        'Başkanı yalnızca sistem yöneticisi görevden alabilir',
      );
    }

    return this.prisma.associationMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
      include: MEMBER_INCLUDE,
    });
  }

  async unlinkMemberTelegram(
    associationId: string,
    membershipId: string,
  ): Promise<{ unlinked: boolean }> {
    const membership = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    return this.auth.unlinkTelegram(membership.userId);
  }

  async generateTelegramLink(
    associationId: string,
    membershipId: string,
    email?: string,
  ) {
    const membership = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { userId: true, user: { select: { email: true } } },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    const targetEmail = email ?? membership.user.email;
    if (!targetEmail) {
      throw new BadRequestException('E-posta adresi bulunamadı');
    }

    return this.auth.generateLinkTokenWithEmail(membership.userId, targetEmail);
  }

  private async applyMemberPermissions(
    associationId: string,
    userId: string,
    titleAssignments?: { titleId?: string | null }[],
  ): Promise<void> {
    await this.permissions.applyMembershipDefaults(associationId, userId);
    if (titleAssignments && titleAssignments.length > 0) {
      await this.permissions.applyTitleDerivedPermissions(
        associationId,
        userId,
        titleAssignments.map((a) => a.titleId ?? null),
      );
    }
  }

  private normalizeTitleAssignments(
    assignments: { titleId?: string | null; customTitle?: string | null; isPrimary?: boolean; sortOrder?: number }[],
  ): { titleId?: string | null; customTitle?: string | null; isPrimary: boolean; sortOrder: number }[] {
    let hasPrimary = false;
    const normalized = assignments.map((a, i) => {
      if (a.isPrimary) hasPrimary = true;
      return {
        titleId: a.titleId ?? null,
        customTitle: a.customTitle ?? null,
        isPrimary: a.isPrimary ?? false,
        sortOrder: a.sortOrder ?? i,
      };
    });

    if (!hasPrimary && normalized.length > 0) {
      normalized[0].isPrimary = true;
    }

    return normalized;
  }

  private async ensureAssociation(id: string) {
    const exists = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Dernek bulunamadı');
  }

  private async ensureMembership(associationId: string, membershipId: string) {
    const found = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { id: true, role: true, userId: true },
    });
    if (!found) throw new NotFoundException('Üyelik bulunamadı');
    return found;
  }
}
