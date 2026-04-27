import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService, UserRole } from '@ticketbot/database';
import {
  CreateAssociationInput,
  ListAssociationsQuery,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AssociationsRepository } from './associations.repository';
import { UsersService } from '../users/users.service';

export interface DeleteResult {
  associationId: string;
  membershipsDeleted: number;
  telegramAccountsUnlinked: number;
}

@Injectable()
export class AssociationsService {
  private readonly logger = new Logger(AssociationsService.name);

  constructor(
    private readonly repository: AssociationsRepository,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Saga: tax-number pre-check → Supabase + local user → tx { assoc +
   * membership } → on tx failure undo the user we just created. If the
   * Supabase step itself fails, there's nothing to undo.
   */
  async create(input: CreateAssociationInput, createdById: string) {
    const { manager, ...associationData } = input;

    if (input.taxNumber) {
      const exists = await this.repository.existsByTaxNumber(input.taxNumber);
      if (exists) {
        throw new ConflictException(
          'Bu vergi numarasıyla kayıtlı bir dernek zaten mevcut',
        );
      }
    }

    const managerUser = await this.users.createSupabaseUser({
      email: manager.email,
      fullName: manager.fullName,
      phone: manager.phone,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const association = await tx.association.create({
          data: {
            ...associationData,
            foundedAt: new Date(associationData.foundedAt),
            createdById,
          },
        });

        await tx.associationMembership.create({
          data: {
            userId: managerUser.id,
            associationId: association.id,
            role: UserRole.ASSOCIATION_MANAGER,
            isActive: true,
          },
        });

        return association;
      });
    } catch (e) {
      try {
        await this.users.deleteUser({
          id: managerUser.id,
          supabaseUserId: managerUser.supabaseUserId,
        });
      } catch (rollbackErr) {
        this.logger.error(
          `Saga rollback failed for user ${managerUser.id}: ${
            (rollbackErr as Error).message
          }`,
        );
      }
      throw e;
    }
  }

  async findOne(id: string) {
    const association = await this.repository.findById(id);
    if (!association) throw new NotFoundException('Dernek bulunamadı');
    return association;
  }

  /**
   * Deletes exactly what belongs to this association and nothing else:
   * - Hard-deletes all AssociationMembership rows for this association.
   * - Unlinks TelegramAccount only for users who have no membership in any
   *   other association (they would lose all bot access anyway).
   * - Soft-deletes tasks and meeting notes for this association.
   * - Soft-deletes the association record itself.
   *
   * User records are never touched — they may belong to other associations
   * or have historical task/meeting references that must stay intact.
   */
  async delete(id: string): Promise<DeleteResult> {
    const association = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!association) throw new NotFoundException('Dernek bulunamadı');

    // Unique user IDs that have any membership row in this association.
    const memberships = await this.prisma.associationMembership.findMany({
      where: { associationId: id },
      select: { userId: true },
      distinct: ['userId'],
    });
    const allUserIds = memberships.map((m) => m.userId);

    // Only unlink Telegram for users who have NO membership elsewhere.
    // Users still in another association keep their bot access.
    let telegramUserIds: string[] = [];
    if (allUserIds.length > 0) {
      const withElsewhere = await this.prisma.associationMembership.findMany({
        where: {
          userId: { in: allUserIds },
          associationId: { not: id },
          deletedAt: null,
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      const elsewhereSet = new Set(withElsewhere.map((m) => m.userId));
      telegramUserIds = allUserIds.filter((uid) => !elsewhereSet.has(uid));
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Unlink Telegram for members with no other association.
      const { count: telegramCount } = await tx.telegramAccount.deleteMany({
        where: { userId: { in: telegramUserIds } },
      });

      // 2. Hard-delete all membership rows for this association.
      const { count: membershipCount } = await tx.associationMembership.deleteMany({
        where: { associationId: id },
      });

      // 3. Soft-delete tasks and meeting notes.
      //    (Both have onDelete:Cascade from Association in the schema, but we
      //     soft-delete rather than hard-delete to preserve audit history.)
      await tx.task.updateMany({
        where: { associationId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.meetingNote.updateMany({
        where: { associationId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      // 4. Soft-delete the association.
      await tx.association.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      });

      return {
        associationId: id,
        membershipsDeleted: membershipCount,
        telegramAccountsUnlinked: telegramCount,
      };
    });

    this.logger.log(
      `Association ${id} deleted — ${result.membershipsDeleted} memberships, ` +
        `${result.telegramAccountsUnlinked} Telegram links unlinked`,
    );

    return result;
  }

  async list(query: ListAssociationsQuery, user: AuthenticatedUser) {
    const scopedToUserId =
      user.systemRole === UserRole.SYSTEM_ADMIN ? undefined : user.id;

    const { data, total } = await this.repository.findMany({
      ...query,
      scopedToUserId,
    });
    const { page, pageSize } = query;
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getStats(id: string) {
    const association = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!association) throw new NotFoundException('Dernek bulunamadı');

    const [members, tasks, totalMeetings] = await this.prisma.$transaction([
      this.prisma.associationMembership.findMany({
        where: { associationId: id, isActive: true, deletedAt: null },
        select: { role: true },
      }),
      this.prisma.task.findMany({
        where: { associationId: id, deletedAt: null },
        select: { status: true },
      }),
      this.prisma.meetingNote.count({
        where: { associationId: id, deletedAt: null },
      }),
    ]);

    const membersByRole: Record<string, number> = {};
    for (const m of members) {
      membersByRole[m.role] = (membersByRole[m.role] ?? 0) + 1;
    }
    const totalMembers = members.length;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const pendingTasks = totalTasks - completedTasks;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalMembers,
      membersByRole,
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate,
      totalMeetings,
    };
  }
}
