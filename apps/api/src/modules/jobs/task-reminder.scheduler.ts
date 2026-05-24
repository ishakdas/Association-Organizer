import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import { TASK_REMINDERS_QUEUE } from './jobs.constants';
import { PgBossService } from './pgboss.service';

export type TaskReminderJobType = 'DUE' | 'REMINDER';

export interface TaskReminderJobData {
  type: TaskReminderJobType;
  taskId: string;
}

export interface SchedulableTask {
  id: string;
  dueDate: Date | null;
  reminderAt: Date | null;
}

@Injectable()
export class TaskReminderScheduler {
  private readonly logger = new Logger(TaskReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boss: PgBossService,
  ) {}

  async scheduleTask(task: SchedulableTask): Promise<void> {
    const now = Date.now();

    if (task.dueDate) {
      const delay = task.dueDate.getTime() - now;
      if (delay > 0) {
        const id = await this.sendJob(
          { type: 'DUE', taskId: task.id },
          task.dueDate,
        );
        if (id) await this.persistJobId(task.id, 'dueJobId', id);
      } else {
        this.logger.warn(
          `Task ${task.id}: dueDate ${task.dueDate.toISOString()} is in the past (delay=${delay}ms); skipping DUE job`,
        );
      }
    }

    if (task.reminderAt) {
      const delay = task.reminderAt.getTime() - now;
      if (delay > 0) {
        const id = await this.sendJob(
          { type: 'REMINDER', taskId: task.id },
          task.reminderAt,
        );
        if (id) await this.persistJobId(task.id, 'reminderJobId', id);
      } else {
        this.logger.warn(
          `Task ${task.id}: reminderAt ${task.reminderAt.toISOString()} is in the past (delay=${delay}ms); skipping REMINDER job`,
        );
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    const row = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { dueJobId: true, reminderJobId: true },
    });
    if (!row) return;

    const cancels: Promise<unknown>[] = [];
    if (row.dueJobId) {
      cancels.push(this.boss.cancel(TASK_REMINDERS_QUEUE, row.dueJobId));
    }
    if (row.reminderJobId) {
      cancels.push(this.boss.cancel(TASK_REMINDERS_QUEUE, row.reminderJobId));
    }
    await Promise.all(cancels);

    if (row.dueJobId || row.reminderJobId) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { dueJobId: null, reminderJobId: null },
      });
    }
  }

  async rescheduleTask(task: SchedulableTask): Promise<void> {
    await this.cancelTask(task.id);
    await this.scheduleTask(task);
  }

  async scheduleNextReminder(taskId: string, nextAt: Date): Promise<void> {
    const delay = nextAt.getTime() - Date.now();
    if (delay <= 0) return;

    const row = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { reminderJobId: true },
    });
    if (row?.reminderJobId) {
      await this.boss.cancel(TASK_REMINDERS_QUEUE, row.reminderJobId);
    }

    const id = await this.sendJob({ type: 'REMINDER', taskId }, nextAt);
    if (id) await this.persistJobId(taskId, 'reminderJobId', id);
  }

  private async sendJob(
    data: TaskReminderJobData,
    runAt: Date,
  ): Promise<string | null> {
    return this.boss.send(TASK_REMINDERS_QUEUE, data, {
      startAfter: runAt,
      retryLimit: 3,
      retryDelay: 60,
      retentionMinutes: 60,
      expireInMinutes: 15,
    });
  }

  private async persistJobId(
    taskId: string,
    field: 'dueJobId' | 'reminderJobId',
    jobId: string,
  ): Promise<void> {
    try {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { [field]: jobId },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist ${field} for task ${taskId}: ${(err as Error).message}`,
      );
    }
  }
}
