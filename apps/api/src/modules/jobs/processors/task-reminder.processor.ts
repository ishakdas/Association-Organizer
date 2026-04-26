import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { addDays, addMonths, addWeeks } from 'date-fns';
import {
  PrismaService,
  ReminderFrequency,
  TaskActivityAction,
  TaskStatus,
} from '@ticketbot/database';
import {
  BotService,
  formatDueMessage,
  formatReminderMessage,
  reminderActionsKeyboard,
} from 'bot';
import { TASK_REMINDERS_QUEUE } from '../jobs.constants';
import {
  TaskReminderJobData,
  TaskReminderScheduler,
} from '../task-reminder.scheduler';

@Processor(TASK_REMINDERS_QUEUE)
export class TaskReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly scheduler: TaskReminderScheduler,
  ) {
    super();
  }

  async process(job: Job<TaskReminderJobData>): Promise<void> {
    const { type, taskId } = job.data;

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        reminderAt: true,
        reminderFrequency: true,
        status: true,
        priority: true,
        assignedToUserId: true,
      },
    });

    if (!task) {
      this.logger.debug(`Task ${taskId} not found or deleted; skipping ${type}`);
      return;
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      this.logger.debug(`Task ${taskId} is ${task.status}; skipping ${type}`);
      return;
    }

    const keyboard = reminderActionsKeyboard(task.id).reply_markup;

    const payload = {
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
    };

    const text =
      type === 'DUE' ? formatDueMessage(payload) : formatReminderMessage(payload);

    const sent = await this.bot.sendToUser(task.assignedToUserId, text, {
      replyMarkup: keyboard,
    });

    if (sent) {
      await this.prisma.$transaction([
        this.prisma.task.update({
          where: { id: task.id },
          data: {
            notifiedViaTelegram: true,
            lastNotifiedAt: new Date(),
          },
        }),
        this.prisma.taskActivity.create({
          data: {
            taskId: task.id,
            // System-triggered: no real user actor. We anchor on the
            // assignee so the FK holds; the UI overrides the displayed
            // name to "Sistem" for REMINDER_SENT regardless of actor.
            actorId: task.assignedToUserId,
            action: TaskActivityAction.REMINDER_SENT,
            payload: { type, channel: 'telegram' },
          },
        }),
      ]);
    }

    if (type !== 'REMINDER') return;
    if (task.reminderFrequency === ReminderFrequency.ONCE) return;
    if (task.reminderFrequency === ReminderFrequency.NONE) return;
    if (!task.reminderAt) return;

    const next = nextReminderAt(task.reminderAt, task.reminderFrequency);
    if (!next) return;

    if (task.dueDate && next.getTime() > task.dueDate.getTime()) return;
    if (next.getTime() <= Date.now()) return;

    await this.scheduler.scheduleNextReminder(task.id, next);
  }
}

function nextReminderAt(
  current: Date,
  frequency: ReminderFrequency,
): Date | null {
  const now = Date.now();
  let cursor = new Date(current);
  while (cursor.getTime() <= now) {
    switch (frequency) {
      case ReminderFrequency.DAILY:
        cursor = addDays(cursor, 1);
        break;
      case ReminderFrequency.WEEKLY:
        cursor = addWeeks(cursor, 1);
        break;
      case ReminderFrequency.MONTHLY:
        cursor = addMonths(cursor, 1);
        break;
      default:
        return null;
    }
  }
  return cursor;
}
