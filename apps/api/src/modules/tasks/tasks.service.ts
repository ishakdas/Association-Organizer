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
  UpdateTaskStatusInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AiService } from '@ticketbot/ai';
import {
  BotService,
  assignmentActionsKeyboard,
  formatAssignmentMessage,
} from 'bot';
import { TaskReminderScheduler } from '../jobs/task-reminder.scheduler';
import { IcsTokenService } from './ics-token.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: TaskReminderScheduler,
    private readonly bot: BotService,
    private readonly icsTokens: IcsTokenService,
    private readonly aiService: AiService,
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

    const telegram = await this.prisma.telegramAccount.findUnique({
      where: { userId: input.assignedToUserId },
      select: { userId: true },
    });
    if (!telegram) {
      throw new BadRequestException(
        'Atanan üyenin Telegram hesabı bağlı değil. Görev atayabilmek için üyenin önce Telegram\'ı bağlaması gerekmektedir.',
      );
    }

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

    // Fire-and-forget: notification is best-effort and must not block the
    // HTTP response. Errors are swallowed inside notifyAssignment.
    void this.notifyAssignment(task);

    return task;
  }

  // Sends an "atama" DM to the assignee on Telegram and logs an
  // ASSIGNED_NOTIFIED activity. Failures (no Telegram bound, send
  // error) are swallowed so a flaky bot can't fail task creation —
  // assignees see the task in the web UI regardless.
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
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
        },
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

  // Cross-association list for the global Görevler page. The visible
  // set is computed from the caller's memberships:
  //   - SYSTEM_ADMIN  : every association
  //   - MANAGER/SECRT : every task in those associations
  //   - MEMBER        : only tasks assigned to the caller in that association
  // Optional `associationId` and `status` filters narrow within that set.
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

    const { page, pageSize } = query;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data,
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
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
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
          watcher: { select: { id: true, fullName: true } },
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

    return updated;
  }

  // Sets the task's dueDate to an absolute new instant. Used by the
  // Telegram snooze submenu and inline-calendar callbacks. Authorization
  // mirrors extendDueDate (assignee only). The reminder schedule is
  // re-anchored against the new due date.
  async snoozeDueDateViaBot(
    taskId: string,
    actingUserId: string,
    newDueDate: Date,
  ) {
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

  // Records that the assignee acknowledged ownership of the task from
  // the assignment DM ("Kabul ediyorum"). Idempotent — re-tapping the
  // button does not insert a second activity row. Status of the task
  // itself isn't mutated; PENDING stays PENDING and the reminder
  // schedule continues unchanged.
  async acceptViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        status: true,
        assignedToUserId: true,
        disputed: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevi siz üstlenemezsiniz');
    }
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

      // PENDING → IN_PROGRESS on first acceptance. Mirrors the standard
      // STATUS_CHANGED audit row used elsewhere; reminder schedule is
      // not touched (deadline still applies, work is now in progress).
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

  // Flags a task as disputed by the assignee ("Bana ait değil"). The
  // assignee stays on the task; the manager resolves the dispute from
  // the web (reassign or dismiss — handled in Faz D). Reminders are
  // paused until resolution so we don't badger the wrong person.
  async disputeViaBot(taskId: string, actingUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        status: true,
        assignedToUserId: true,
        disputed: true,
      },
    });
    if (!task) throw new NotFoundException('Görev bulunamadı');
    if (task.assignedToUserId !== actingUserId) {
      throw new ForbiddenException('Bu görevde itiraz hakkınız yok');
    }
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Bu görev zaten kapalı');
    }

    if (task.disputed) {
      // Idempotent: re-pressing "Bana ait değil" doesn't double-log.
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

    return updated;
  }

  // Returns the minimal context the bot integration needs to re-render
  // the assignment keyboard when the user taps "Geri" out of the snooze
  // submenu. Authorizes that the caller is still the assignee — anyone
  // else interacting with someone else's DM gets a Forbidden.
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

  // Returns the activity timeline for a single task. Authorization
  // mirrors `list`: SYSTEM_ADMIN sees everything, MANAGER/SECRETARY in
  // the task's association sees everything, MEMBER only sees activities
  // for tasks assigned to them.
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

  private isMemberOnly(user: AuthenticatedUser, associationId: string): boolean {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return false;
    const inAssoc = user.memberships.filter(
      (m) => m.isActive && m.associationId === associationId,
    );
    if (inAssoc.length === 0) return true;
    return inAssoc.every((m) => m.role === UserRole.ASSOCIATION_MEMBER);
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
