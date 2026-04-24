import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole, Prisma, TaskStatus } from '@ticketbot/database';
import { addDays } from 'date-fns';
import {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskStatusInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { TaskReminderScheduler } from '../jobs/task-reminder.scheduler';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: TaskReminderScheduler,
  ) {}

  async create(
    associationId: string,
    input: CreateTaskInput,
    user: AuthenticatedUser,
  ) {
    await this.ensureAssigneeIsMember(associationId, input.assignedToUserId);

    const task = await this.prisma.task.create({
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

    await this.scheduler.scheduleTask({
      id: task.id,
      dueDate: task.dueDate,
      reminderAt: task.reminderAt,
    });

    return task;
  }

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

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
    });

    if (input.status === 'COMPLETED' || input.status === 'CANCELLED') {
      await this.scheduler.cancelTask(taskId);
    }

    return updated;
  }

  async markCompletedViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, status: true, assignedToUserId: true },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevi tamamlayamazsınız');
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      return this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
    });

    await this.scheduler.cancelTask(taskId);

    return updated;
  }

  async extendDueDate(taskId: string, actingUserId: string, days: number) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        status: true,
        dueDate: true,
        reminderAt: true,
        assignedToUserId: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevi erteleyemezsiniz');
    }
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }
    if (!task.dueDate) {
      throw new BadRequestException('Bitiş tarihi yok');
    }

    const newDue = addDays(task.dueDate, days);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { dueDate: newDue },
    });

    await this.scheduler.rescheduleTask({
      id: updated.id,
      dueDate: updated.dueDate,
      reminderAt: updated.reminderAt,
    });

    return updated;
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

  private isMemberOnly(user: AuthenticatedUser, associationId: string): boolean {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return false;
    const inAssoc = user.memberships.filter(
      (m) => m.isActive && m.associationId === associationId,
    );
    if (inAssoc.length === 0) return true;
    return inAssoc.every((m) => m.role === UserRole.ASSOCIATION_MEMBER);
  }
}
