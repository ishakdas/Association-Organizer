import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  UserRole,
  Prisma,
  TaskStatus,
  TaskActivityAction,
} from '@ticketbot/database';
import { addDays } from 'date-fns';
import {
  CreateTaskInput,
  ListMyTasksQuery,
  ListTasksQuery,
  ResolveDisputeInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  ExtractTasksFromMeetingInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@ticketbot/ai';
import {
  BotService,
  assignmentActionsKeyboard,
  formatAssignmentMessage,
  escapeMarkdown,
} from 'bot';
import { TaskReminderScheduler } from '../jobs/task-reminder.scheduler';
import { IcsTokenService } from './ics-token.service';
import { TaskNotificationService } from './task-notification.service';

const PRIORITY_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const MAX_OPEN_TASKS_BEFORE_WARNING = 10;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: TaskReminderScheduler,
    private readonly bot: BotService,
    private readonly icsTokens: IcsTokenService,
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly notificationService: TaskNotificationService,
  ) {}

  async create(
    associationId: string,
    input: CreateTaskInput,
    user: AuthenticatedUser,
  ) {
    await this.ensureAssigneeIsMember(associationId, input.assignedToUserId);
    if (input.watcherUserId) {
      await this.ensureAssigneeIsMember(associationId, input.watcherUserId);
    }

    // Due date validation: prevent past dates
    if (input.dueDate && new Date(input.dueDate) < new Date()) {
      throw new BadRequestException('Bitiş tarihi geçmiş olamaz');
    }

    // Workload check: warn if assignee has too many open tasks
    const workloadWarning = await this.getWorkloadWarning(associationId, input.assignedToUserId);

    const assigneeTelegram = await this.prisma.telegramAccount.findUnique({
      where: { userId: input.assignedToUserId },
      select: { userId: true },
    });

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          associationId,
          title: input.title,
          description: input.description ?? null,
          assignedToUserId: input.assignedToUserId,
          assignedById: user.id,
          watcherUserId: input.watcherUserId ?? null,
          priority: input.priority,
          reminderFrequency: input.reminderFrequency,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
        },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: created.id,
          actorId: user.id,
          action: TaskActivityAction.CREATED,
          payload: {
            assigneeId: created.assignedToUserId,
            watcherId: created.watcherUserId,
            priority: created.priority,
            dueDate: created.dueDate?.toISOString() ?? null,
          },
        },
      });

      return created;
    });

    try {
      await this.scheduler.scheduleTask({
        id: task.id,
        dueDate: task.dueDate,
        reminderAt: task.reminderAt,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to schedule reminders for task ${task.id}: ${(err as Error).message}`,
      );
    }

    if (assigneeTelegram) {
      void this.notifyAssignment(task);
    } else {
      void this.prisma.taskActivity
        .create({
          data: {
            taskId: task.id,
            actorId: task.assignedById,
            action: TaskActivityAction.ASSIGNED_NOTIFIED,
            payload: { channel: 'telegram', delivered: false, reason: 'no_telegram' },
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Activity log failed for no-telegram assignment ${task.id}: ${(err as Error).message}`,
          );
        });
    }

    return {
      ...task,
      durationHours: null,
      workloadWarning,
    };
  }

  private async getWorkloadWarning(associationId: string, userId: string): Promise<string | null> {
    const openCount = await this.prisma.task.count({
      where: {
        associationId,
        assignedToUserId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        deletedAt: null,
      },
    });

    if (openCount >= MAX_OPEN_TASKS_BEFORE_WARNING) {
      return `Atanan kişinin ${openCount} açık görevi var`;
    }
    return null;
  }

  private computeDurationHours(task: { createdAt: Date; completedAt: Date | null }): number | null {
    if (!task.completedAt) return null;
    const ms = task.completedAt.getTime() - task.createdAt.getTime();
    return Math.round(ms / (1000 * 60 * 60) * 100) / 100;
  }

  private async notifyAssignment(task: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: TaskStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    assignedToUserId: string;
    assignedById: string;
    assignedBy: { id: string; fullName: string };
  }): Promise<void> {
    try {
      const icsUrl = task.dueDate
        ? this.icsTokens.signTaskIcsUrl(task.id)
        : undefined;

      const text = formatAssignmentMessage(
        {
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          status: task.status,
          priority: task.priority,
        },
        task.assignedBy.fullName,
      );

      const keyboard = assignmentActionsKeyboard(task.id, { icsUrl }).reply_markup;
      const delivered = await this.bot.sendToUser(task.assignedToUserId, text, {
        replyMarkup: keyboard,
      });

      await this.prisma.task.update({
        where: { id: task.id },
        data: { notifiedViaTelegram: true, lastNotifiedAt: new Date() },
      });

      await this.prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: task.assignedById,
          action: TaskActivityAction.ASSIGNED_NOTIFIED,
          payload: { channel: 'telegram', delivered },
        },
      });
    } catch (err) {
      this.logger.warn(
        `Assignment notification failed for task ${task.id}: ${(err as Error).message}`,
      );
    }
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
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    if (this.isMemberOnly(user, associationId)) {
      where.assignedToUserId = user.id;
    }

    const { page, pageSize, sortBy, sortOrder } = query;
    const orderBy: Prisma.TaskOrderByWithRelationInput = {};
    if (sortBy === 'priority') {
      orderBy.priority = sortOrder;
    } else if (sortBy === 'dueDate') {
      orderBy.dueDate = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        ...t,
        durationHours: this.computeDurationHours(t),
        workloadWarning: null,
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getOne(
    associationId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, associationId, deletedAt: null },
      include: {
        assignedBy: { select: { id: true, fullName: true } },
        watcher: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
        association: { select: { id: true, name: true } },
      },
    });

    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (this.isMemberOnly(user, associationId) && task.assignedToUserId !== user.id) {
      throw new ForbiddenException('Bu görevi görüntüleme yetkiniz yok');
    }

    return {
      ...task,
      durationHours: this.computeDurationHours(task),
      workloadWarning: null,
    };
  }

  async listForUser(query: ListMyTasksQuery, user: AuthenticatedUser) {
    const isSysAdmin = user.systemRole === UserRole.SYSTEM_ADMIN;
    const active = user.memberships.filter((m) => m.isActive);

    if (!isSysAdmin && active.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: query.page, pageSize: query.pageSize, totalPages: 1 },
      };
    }

    const orClauses: Prisma.TaskWhereInput[] = [];
    if (isSysAdmin) {
      orClauses.push({});
    } else {
      const privilegedAssoc = active
        .filter(
          (m) =>
            m.role === UserRole.ASSOCIATION_MANAGER ||
            m.role === UserRole.ASSOCIATION_SECRETARY,
        )
        .map((m) => m.associationId);
      const memberOnlyAssoc = active
        .filter((m) => m.role === UserRole.ASSOCIATION_MEMBER)
        .map((m) => m.associationId);

      if (privilegedAssoc.length > 0) {
        orClauses.push({ associationId: { in: privilegedAssoc } });
      }
      if (memberOnlyAssoc.length > 0) {
        orClauses.push({
          associationId: { in: memberOnlyAssoc },
          assignedToUserId: user.id,
        });
      }
    }

    if (orClauses.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: query.page, pageSize: query.pageSize, totalPages: 1 },
      };
    }

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      OR: orClauses,
    };
    if (query.status) where.status = query.status;
    if (query.associationId) where.associationId = query.associationId;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    const { page, pageSize, sortBy, sortOrder } = query;
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
    if (sortBy === 'priority') {
      orderBy.push({ priority: sortOrder });
    } else if (sortBy === 'dueDate') {
      orderBy.push({ dueDate: sortOrder });
    } else if (sortBy === 'title') {
      orderBy.push({ title: sortOrder });
    } else {
      orderBy.push({ createdAt: sortOrder });
    }
    orderBy.push({ status: 'asc' });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          association: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, fullName: true } },
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: rows.map(({ assignedTo, assignedBy, watcher, ...rest }) => ({
        ...rest,
        association: rest.association,
        assignedBy: { id: assignedBy.id, fullName: assignedBy.fullName },
        watcher: watcher ? { id: watcher.id, fullName: watcher.fullName } : null,
        assignee: { id: assignedTo.id, fullName: assignedTo.fullName },
        durationHours: this.computeDurationHours(rest),
        workloadWarning: null,
      })),
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
      select: { id: true, associationId: true, status: true, assignedToUserId: true, createdAt: true, title: true },
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data,
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });

      if (next.status !== task.status) {
        await tx.taskActivity.create({
          data: {
            taskId,
            actorId: user.id,
            action: TaskActivityAction.STATUS_CHANGED,
            payload: { from: task.status, to: next.status },
          },
        });
      }

      return next;
    });

    if (input.status === 'COMPLETED' || input.status === 'CANCELLED') {
      await this.scheduler.cancelTask(taskId);
    }

    this.sendStatusNotification(task, updated, user).catch((err) => {
      this.logger.warn(`Bildirim gönderilemedi: ${(err as Error).message}`);
    });

    return {
      ...updated,
      durationHours: this.computeDurationHours(updated),
      workloadWarning: null,
    };
  }

  private async sendStatusNotification(
    originalTask: { id: string; associationId: string; status: string; assignedToUserId: string; createdAt: Date; title: string },
    updatedTask: any,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (updatedTask.status === 'COMPLETED' && originalTask.status !== 'COMPLETED') {
      await this.notificationService.notifyTaskCompleted(
        originalTask.associationId,
        originalTask.id,
        originalTask.title,
        updatedTask.assignedTo?.fullName ?? 'Bilinmeyen',
        originalTask.createdAt,
        updatedTask.completedAt ?? new Date(),
      );
    } else if (updatedTask.status === 'CANCELLED' && originalTask.status !== 'CANCELLED') {
      await this.notificationService.notifyTaskCancelled(
        originalTask.associationId,
        originalTask.id,
        originalTask.title,
        updatedTask.assignedTo?.fullName ?? 'Bilinmeyen',
        actor.id === updatedTask.assignedTo?.id ? updatedTask.assignedTo.fullName : (updatedTask.assignedBy?.fullName ?? 'Bilinmeyen'),
      );
    }
  }

  async update(
    taskId: string,
    input: UpdateTaskInput,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: {
        assignedBy: { select: { id: true, fullName: true } },
        watcher: { select: { id: true, fullName: true } },
      },
    });
    if (!existing) throw new NotFoundException('Görev bulunamadı');

    this.assertCanManageTask(user, existing.associationId);

    // Due date validation: prevent past dates on update
    if (input.dueDate && new Date(input.dueDate) < new Date()) {
      throw new BadRequestException('Bitiş tarihi geçmiş olamaz');
    }

    if (
      input.assignedToUserId &&
      input.assignedToUserId !== existing.assignedToUserId
    ) {
      await this.ensureAssigneeIsMember(
        existing.associationId,
        input.assignedToUserId,
      );
    }
    if (input.watcherUserId) {
      await this.ensureAssigneeIsMember(
        existing.associationId,
        input.watcherUserId,
      );
    }

    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.dueDate !== undefined)
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.reminderAt !== undefined)
      data.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
    if (input.reminderFrequency !== undefined)
      data.reminderFrequency = input.reminderFrequency;
    if (input.assignedToUserId !== undefined) {
      data.assignedTo = { connect: { id: input.assignedToUserId } };
      data.disputed = false;
      data.disputedAt = null;
    }
    if (input.watcherUserId !== undefined) {
      data.watcher = input.watcherUserId
        ? { connect: { id: input.watcherUserId } }
        : { disconnect: true };
    }

    const reassigned =
      input.assignedToUserId !== undefined &&
      input.assignedToUserId !== existing.assignedToUserId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data,
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });

      const activities: Prisma.TaskActivityCreateManyInput[] = [];
      if (input.title !== undefined && input.title !== existing.title) {
        activities.push({
          taskId,
          actorId: user.id,
          action: TaskActivityAction.TITLE_CHANGED,
          payload: { from: existing.title, to: next.title },
        });
      }
      if (
        input.description !== undefined &&
        input.description !== existing.description
      ) {
        activities.push({
          taskId,
          actorId: user.id,
          action: TaskActivityAction.DESCRIPTION_CHANGED,
          payload: { from: existing.description, to: next.description },
        });
      }
      if (
        input.priority !== undefined &&
        input.priority !== existing.priority
      ) {
        activities.push({
          taskId,
          actorId: user.id,
          action: TaskActivityAction.PRIORITY_CHANGED,
          payload: { from: existing.priority, to: next.priority },
        });
      }
      if (input.dueDate !== undefined) {
        const fromIso = existing.dueDate?.toISOString() ?? null;
        const toIso = next.dueDate?.toISOString() ?? null;
        if (fromIso !== toIso) {
          activities.push({
            taskId,
            actorId: user.id,
            action: TaskActivityAction.DUE_DATE_CHANGED,
            payload: { from: fromIso, to: toIso },
          });
        }
      }
      if (
        input.reminderAt !== undefined ||
        input.reminderFrequency !== undefined
      ) {
        activities.push({
          taskId,
          actorId: user.id,
          action: TaskActivityAction.REMINDER_CHANGED,
          payload: {
            reminderAt: next.reminderAt?.toISOString() ?? null,
            reminderFrequency: next.reminderFrequency,
          },
        });
      }
      if (reassigned) {
        activities.push({
          taskId,
          actorId: user.id,
          action: TaskActivityAction.REASSIGNED,
          payload: {
            from: existing.assignedToUserId,
            to: next.assignedToUserId,
          },
        });
      }
      if (activities.length > 0) {
        await tx.taskActivity.createMany({ data: activities });
      }

      return next;
    });

    // Reschedule reminders if dueDate or reminderAt changed
    if (input.dueDate !== undefined || input.reminderAt !== undefined || input.reminderFrequency !== undefined) {
      try {
        await this.scheduler.rescheduleTask({
          id: updated.id,
          dueDate: updated.dueDate,
          reminderAt: updated.reminderAt,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to reschedule task ${updated.id}: ${(err as Error).message}`,
        );
      }
    }

    if (reassigned) {
      const assigneeTelegram = await this.prisma.telegramAccount.findUnique({
        where: { userId: updated.assignedToUserId },
        select: { userId: true },
      });
      if (assigneeTelegram) {
        void this.notifyAssignment({
          id: updated.id,
          title: updated.title,
          description: updated.description,
          dueDate: updated.dueDate,
          status: updated.status,
          priority: updated.priority,
          assignedToUserId: updated.assignedToUserId,
          assignedById: updated.assignedById,
          assignedBy: updated.assignedBy,
        });
      } else {
        void this.prisma.taskActivity
          .create({
            data: {
              taskId: updated.id,
              actorId: user.id,
              action: TaskActivityAction.ASSIGNED_NOTIFIED,
              payload: { channel: 'telegram', delivered: false, reason: 'no_telegram' },
            },
          })
          .catch(() => undefined);
      }
    }

    return {
      ...updated,
      durationHours: this.computeDurationHours(updated),
      workloadWarning: null,
    };
  }

  async softDelete(
    associationId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, associationId, deletedAt: null },
      select: { id: true, title: true, status: true, assignedToUserId: true },
    });
    if (!existing) throw new NotFoundException('Görev bulunamadı');

    this.assertCanManageTask(user, associationId);

    const deleted = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
      include: {
        assignedBy: { select: { id: true, fullName: true } },
        watcher: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    await this.scheduler.cancelTask(taskId);

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        actorId: user.id,
        action: TaskActivityAction.STATUS_CHANGED,
        payload: { to: 'DELETED', reason: 'soft_delete' },
      },
    });

    return {
      ...deleted,
      durationHours: this.computeDurationHours(deleted),
      workloadWarning: null,
    };
  }

  async extractTasksFromMeeting(
    associationId: string,
    input: ExtractTasksFromMeetingInput,
    user: AuthenticatedUser,
  ) {
    this.assertCanManageTask(user, associationId);

    const meeting = await this.prisma.meetingNote.findFirst({
      where: { id: input.meetingNoteId, associationId, deletedAt: null },
      include: { attendees: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    if (!meeting) throw new NotFoundException('Toplantı bulunamadı');

    // Use AI to extract action items from meeting content
    try {
      const extracted = await this.aiService.extractTasksFromMeeting(meeting.content);

      const createdTasks = [];
      for (const item of extracted.tasks) {
        // Try to match assignee by name
        let assigneeUserId: string | null = null;
        if (item.assigneeName) {
          const matched = meeting.attendees.find(
            (a) => a.user.fullName.toLowerCase().includes(item.assigneeName!.toLowerCase()),
          );
          if (matched) assigneeUserId = matched.user.id;
        }

        if (!assigneeUserId) {
          // Default to meeting creator
          assigneeUserId = meeting.createdById;
        }

        const task = await this.prisma.task.create({
          data: {
            associationId,
            title: item.title,
            description: item.description ?? null,
            assignedToUserId: assigneeUserId,
            assignedById: user.id,
            priority: item.priority || 'MEDIUM',
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            sourceMeetingNoteId: meeting.id,
          },
          include: {
            assignedBy: { select: { id: true, fullName: true } },
            watcher: { select: { id: true, fullName: true } },
            assignedTo: { select: { id: true, fullName: true } },
          },
        });

        await this.prisma.taskActivity.create({
          data: {
            taskId: task.id,
            actorId: user.id,
            action: TaskActivityAction.EXTRACTED_FROM_MEETING,
            payload: {
              meetingNoteId: meeting.id,
              meetingTitle: meeting.title,
              originalText: item.originalText,
            },
          },
        });

        createdTasks.push(task);
      }

      return { extractedTasks: createdTasks, count: createdTasks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI meeting extraction failed: ${message}`);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }

  async resolveDispute(
    taskId: string,
    input: ResolveDisputeInput,
    user: AuthenticatedUser,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        associationId: true,
        assignedToUserId: true,
        assignedById: true,
        watcherUserId: true,
        disputed: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (!task.disputed) {
      throw new BadRequestException('Bu görev için bekleyen itiraz yok');
    }

    const isWatcher = task.watcherUserId === user.id;
    const isCreator = task.assignedById === user.id;
    const isManager = this.canManageTask(user, task.associationId);
    if (!isWatcher && !isCreator && !isManager) {
      throw new ForbiddenException('Bu itirazı çözme yetkiniz yok');
    }

    await this.ensureAssigneeIsMember(
      task.associationId,
      input.assignedToUserId,
    );

    return this.update(
      taskId,
      { assignedToUserId: input.assignedToUserId },
      user,
    ).then(async (updated) => {
      await this.prisma.taskActivity.create({
        data: {
          taskId,
          actorId: user.id,
          action: TaskActivityAction.REASSIGNMENT_RESOLVED,
          payload: {
            previousAssignee: task.assignedToUserId,
            newAssignee: input.assignedToUserId,
          },
        },
      });
      return updated;
    });
  }

  async markCompletedViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, status: true, assignedToUserId: true, associationId: true, title: true, createdAt: true },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevi tamamlayamazsınız');
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      return this.prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId,
          actorId: actingUserId,
          action: TaskActivityAction.STATUS_CHANGED,
          payload: { from: task.status, to: next.status, via: 'telegram' },
        },
      });

      return next;
    });

    await this.scheduler.cancelTask(taskId);

    this.notificationService.notifyTaskCompleted(
      task.associationId,
      task.id,
      task.title,
      updated.assignedTo?.fullName ?? 'Bilinmeyen',
      task.createdAt,
      updated.completedAt ?? new Date(),
    ).catch((err) => {
      this.logger.warn(`Bildirim gönderilemedi: ${(err as Error).message}`);
    });

    return updated;
  }

  async snoozeDueDateViaBot(
    taskId: string,
    actingUserId: string,
    newDueDate: Date,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        associationId: true,
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
    await this.assertActiveMembershipViaBot(actingUserId, task.associationId);
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }
    if (Number.isNaN(newDueDate.getTime())) {
      throw new BadRequestException('Geçersiz tarih');
    }
    if (newDueDate.getTime() <= Date.now()) {
      throw new BadRequestException('Yeni tarih geçmiş olamaz');
    }

    const previousDue = task.dueDate;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data: { dueDate: newDueDate },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId,
          actorId: actingUserId,
          action: TaskActivityAction.DUE_DATE_CHANGED,
          payload: {
            from: previousDue?.toISOString() ?? null,
            to: newDueDate.toISOString(),
            via: 'telegram',
          },
        },
      });

      return next;
    });

    try {
      await this.scheduler.rescheduleTask({
        id: updated.id,
        dueDate: updated.dueDate,
        reminderAt: updated.reminderAt,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to reschedule task ${updated.id}: ${(err as Error).message}`,
      );
    }

    return updated;
  }

  async acceptViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        associationId: true,
        status: true,
        assignedToUserId: true,
        disputed: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevi siz üstlenemezsiniz');
    }
    await this.assertActiveMembershipViaBot(actingUserId, task.associationId);
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }
    if (task.disputed) {
      throw new BadRequestException(
        'Bu görev itiraz edilmiş; önce yönetici çözmeli',
      );
    }

    const existing = await this.prisma.taskActivity.findFirst({
      where: { taskId, action: TaskActivityAction.ASSIGNMENT_ACCEPTED },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskActivity.create({
        data: {
          taskId,
          actorId: actingUserId,
          action: TaskActivityAction.ASSIGNMENT_ACCEPTED,
          payload: { via: 'telegram' },
        },
      });

      if (task.status === TaskStatus.PENDING) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.IN_PROGRESS },
        });
        await tx.taskActivity.create({
          data: {
            taskId,
            actorId: actingUserId,
            action: TaskActivityAction.STATUS_CHANGED,
            payload: {
              from: TaskStatus.PENDING,
              to: TaskStatus.IN_PROGRESS,
              via: 'telegram',
              reason: 'accepted',
            },
          },
        });
      }

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });
    });
  }

  async disputeViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        title: true,
        associationId: true,
        status: true,
        assignedToUserId: true,
        assignedById: true,
        watcherUserId: true,
        disputed: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevde itiraz hakkınız yok');
    }
    await this.assertActiveMembershipViaBot(actingUserId, task.associationId);
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }

    if (task.disputed) {
      return this.prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data: { disputed: true, disputedAt: new Date() },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId,
          actorId: actingUserId,
          action: TaskActivityAction.REASSIGNMENT_REQUESTED,
          payload: { via: 'telegram' },
        },
      });

      return next;
    });

    await this.scheduler.cancelTask(taskId);

    void this.notifyDispute({
      taskId: task.id,
      taskTitle: task.title,
      associationId: task.associationId,
      assigneeUserId: task.assignedToUserId,
      watcherUserId: task.watcherUserId,
      assignedById: task.assignedById,
    });

    return updated;
  }

  private async notifyDispute(args: {
    taskId: string;
    taskTitle: string;
    associationId: string;
    assigneeUserId: string;
    watcherUserId: string | null;
    assignedById: string;
  }): Promise<void> {
    try {
      const recipientUserId = args.watcherUserId ?? args.assignedById;

      const assignee = await this.prisma.user.findUnique({
        where: { id: args.assigneeUserId },
        select: { fullName: true },
      });

      const webUrl = this.config.get<string>('webUrl') ?? '';
      const link = webUrl
        ? `${webUrl}/associations/${args.associationId}?disputedTask=${args.taskId}`
        : '';

      const text =
        `⚠️ *Görev itirazı*\n\n` +
        `*${escapeMarkdown(args.taskTitle)}*\n\n` +
        `${escapeMarkdown(assignee?.fullName ?? 'Atanan kişi')} bu görevin kendisine ait olmadığını söyledi.\n\n` +
        `Yeni atayanı seçmek için ${args.watcherUserId ? 'takipçi olarak' : 'görevin sahibi olarak'} web üzerinden açın.` +
        (link ? `\n\n${link}` : '');

      const delivered = await this.bot.sendToUser(recipientUserId, text);

      await this.prisma.taskActivity.create({
        data: {
          taskId: args.taskId,
          actorId: args.assigneeUserId,
          action: TaskActivityAction.ASSIGNED_NOTIFIED,
          payload: {
            channel: 'telegram',
            kind: 'dispute',
            recipientUserId,
            delivered,
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `Dispute notification failed for task ${args.taskId}: ${(err as Error).message}`,
      );
    }
  }

  async getAssignmentBotContext(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        dueDate: true,
        assignedToUserId: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görev size ait değil');
    }
    return task;
  }

  async extendDueDate(taskId: string, actingUserId: string, days: number) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        associationId: true,
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
    await this.assertActiveMembershipViaBot(actingUserId, task.associationId);
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }
    if (!task.dueDate) {
      throw new BadRequestException('Bitiş tarihi yok');
    }

    const previousDue = task.dueDate;
    const newDue = addDays(previousDue, days);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data: { dueDate: newDue },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId,
          actorId: actingUserId,
          action: TaskActivityAction.DUE_DATE_CHANGED,
          payload: {
            from: previousDue.toISOString(),
            to: newDue.toISOString(),
            via: 'telegram',
          },
        },
      });

      return next;
    });

    try {
      await this.scheduler.rescheduleTask({
        id: updated.id,
        dueDate: updated.dueDate,
        reminderAt: updated.reminderAt,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to reschedule task ${updated.id}: ${(err as Error).message}`,
      );
    }

    return updated;
  }

  async listActivities(
    associationId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, associationId, deletedAt: null },
      select: { id: true, assignedToUserId: true },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');

    if (this.isMemberOnly(user, associationId) && task.assignedToUserId !== user.id) {
      throw new ForbiddenException('Bu görevin geçmişine erişiminiz yok');
    }

    const rows = await this.prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      action: row.action,
      payload: row.payload,
      createdAt: row.createdAt,
      actor: row.actor,
    }));
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

  // Bot akışlarında elimizde yalnızca userId var (AuthenticatedUser yok).
  // İşlemi yapanın ilgili dernekte hâlâ aktif üyeliği olduğunu doğrular;
  // üyelikten çıkarılmış biri eski Telegram bağlantısıyla işlem yapamasın diye.
  private async assertActiveMembershipViaBot(
    actingUserId: string,
    associationId: string,
  ): Promise<void> {
    const membership = await this.prisma.associationMembership.findFirst({
      where: {
        associationId,
        userId: actingUserId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Bu dernekte aktif üyeliğiniz yok');
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

  private canManageTask(
    user: AuthenticatedUser,
    associationId: string,
  ): boolean {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return true;
    return user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        (m.role === UserRole.ASSOCIATION_MANAGER ||
          m.role === UserRole.ASSOCIATION_SECRETARY),
    );
  }

  private assertCanManageTask(
    user: AuthenticatedUser,
    associationId: string,
  ): void {
    if (!this.canManageTask(user, associationId)) {
      throw new ForbiddenException('Bu görevi düzenleme yetkiniz yok');
    }
  }

  async prioritizeTasks(associationId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        associationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deletedAt: null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
      take: 30,
    });

    if (tasks.length === 0) {
      return { prioritizedTasks: [] };
    }

    const tasksContext = tasks
      .map((t) => {
        const due = t.dueDate ? `Bitiş: ${t.dueDate.toISOString().slice(0, 10)}` : 'Bitiş yok';
        const assignee = t.assignedTo ? `Atanan: ${t.assignedTo.fullName}` : 'Atanan yok';
        return `- ID: ${t.id} | ${t.title} | Mevcut öncelik: ${t.priority} | ${due} | ${assignee}${t.description ? ` | Açıklama: ${t.description}` : ''}`;
      })
      .join('\n');

    try {
      return await this.aiService.prioritizeTasks(tasksContext);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI task prioritization failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }
}
