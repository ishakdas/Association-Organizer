import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TASK_REMINDERS_QUEUE } from './jobs.constants';

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
    @InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async scheduleTask(task: SchedulableTask): Promise<void> {
    const now = Date.now();

    if (task.dueDate) {
      const delay = task.dueDate.getTime() - now;
      if (delay > 0) {
        await this.addJob(
          this.dueJobId(task.id),
          { type: 'DUE', taskId: task.id },
          delay,
        );
      }
    }

    if (task.reminderAt) {
      const delay = task.reminderAt.getTime() - now;
      if (delay > 0) {
        await this.addJob(
          this.reminderJobId(task.id),
          { type: 'REMINDER', taskId: task.id },
          delay,
        );
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    await Promise.all([
      this.safeRemove(this.dueJobId(taskId)),
      this.safeRemove(this.reminderJobId(taskId)),
    ]);
  }

  async rescheduleTask(task: SchedulableTask): Promise<void> {
    await this.cancelTask(task.id);
    await this.scheduleTask(task);
  }

  async scheduleNextReminder(taskId: string, nextAt: Date): Promise<void> {
    const delay = nextAt.getTime() - Date.now();
    if (delay <= 0) return;
    await this.safeRemove(this.reminderJobId(taskId));
    await this.addJob(
      this.reminderJobId(taskId),
      { type: 'REMINDER', taskId },
      delay,
    );
  }

  private dueJobId(taskId: string): string {
    return `due:${taskId}`;
  }

  private reminderJobId(taskId: string): string {
    return `reminder:${taskId}`;
  }

  private async addJob(
    jobId: string,
    data: TaskReminderJobData,
    delay: number,
  ): Promise<void> {
    await this.queue.add(data.type, data, {
      jobId,
      delay,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    });
  }

  private async safeRemove(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) await job.remove();
    } catch (err) {
      this.logger.warn(
        `Failed to remove job ${jobId}: ${(err as Error).message}`,
      );
    }
  }
}
