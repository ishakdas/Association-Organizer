import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole, Prisma } from '@ticketbot/database';
import {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskStatusInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Caller is already authorized by AssociationRolesGuard
   * (SYSTEM_ADMIN | MANAGER | SECRETARY); we only need to validate that
   * the *assignee* is also a member of this association.
   */
  async create(
    associationId: string,
    input: CreateTaskInput,
    user: AuthenticatedUser,
  ) {
    await this.ensureAssigneeIsMember(associationId, input.assignedToUserId);

    return this.prisma.task.create({
      data: {
        associationId,
        title: input.title,
        description: input.description ?? null,
        assignedToUserId: input.assignedToUserId,
        assignedById: user.id,
        priority: input.priority,
        reminderFrequency: input.reminderFrequency,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      },
    });
  }

  /**
   * MEMBER role sees only tasks assigned to themselves; everyone else
   * (SYSTEM_ADMIN / MANAGER / SECRETARY in this association) sees the full
   * dernek queue.
   */
  async list(
    associationId: string,
    query: ListTasksQuery,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.TaskWhereInput = {
      associationId,
      deletedAt: null,
    };

    if (query.status) where.status = query.status;
    if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId;

    if (this.isMemberOnly(user, associationId)) {
      where.assignedToUserId = user.id;
    }

    const { page, pageSize } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

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

  async updateStatus(
    taskId: string,
    input: UpdateTaskStatusInput,
    user: AuthenticatedUser,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, associationId: true, status: true },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (
      user.systemRole !== UserRole.SYSTEM_ADMIN &&
      !user.memberships.some(
        (m) => m.isActive && m.associationId === task.associationId,
      )
    ) {
      throw new ForbiddenException('Bu görev için yetkiniz yok');
    }

    const data: Prisma.TaskUpdateInput = { status: input.status };
    if (input.status === 'COMPLETED') {
      data.completedAt = new Date();
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data,
    });
  }

  private async ensureAssigneeIsMember(
    associationId: string,
    assigneeUserId: string,
  ) {
    const exists = await this.prisma.associationMembership.findFirst({
      where: {
        associationId,
        userId: assigneeUserId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException('Kullanıcı bu derneğe üye değil');
    }
  }

  /**
   * True if the user's strongest role in *this* association is MEMBER.
   * SYSTEM_ADMIN and any active MANAGER/SECRETARY membership in the
   * dernek bypass the per-user scope.
   */
  private isMemberOnly(user: AuthenticatedUser, associationId: string): boolean {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return false;
    const inAssoc = user.memberships.filter(
      (m) => m.isActive && m.associationId === associationId,
    );
    if (inAssoc.length === 0) return true;
    return inAssoc.every((m) => m.role === UserRole.ASSOCIATION_MEMBER);
  }
}
