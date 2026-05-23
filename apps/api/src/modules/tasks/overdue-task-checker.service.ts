import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService, TaskStatus } from '@ticketbot/database';
import { TaskNotificationService } from './task-notification.service';
import { CronJob } from 'cron';

const BATCH_SIZE = 50;

@Injectable()
export class OverdueTaskChecker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OverdueTaskChecker.name);
  private enabled = false;
  private cronJob?: CronJob;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: TaskNotificationService,
  ) {}

  onModuleInit() {
    this.enabled = process.env.ENABLE_OVERDUE_CHECKER === 'true';
    if (this.enabled) {
      this.logger.log('Overdue task checker enabled (hourly)');
      this.cronJob = new CronJob('0 * * * *', () => this.checkOverdueTasks().catch((err) => {
        this.logger.error('Overdue check failed', err as Error);
      }));
      this.cronJob.start();
    }
  }

  onModuleDestroy() {
    this.cronJob?.stop();
  }

  async checkOverdueTasks(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Checking for overdue tasks...');

    const now = new Date();
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueDate: { lt: now },
        deletedAt: null,
      },
      include: {
        association: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      take: BATCH_SIZE,
      orderBy: { dueDate: 'asc' },
    });

    if (overdueTasks.length === 0) {
      this.logger.log('No overdue tasks found');
      return;
    }

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    // Group by association
    const byAssociation = new Map<string, typeof overdueTasks>();
    for (const task of overdueTasks) {
      const arr = byAssociation.get(task.associationId) ?? [];
      arr.push(task);
      byAssociation.set(task.associationId, arr);
    }

    for (const [assocId, tasks] of byAssociation) {
      try {
        const formatted = tasks.map((t) => ({
          taskId: t.id,
          title: t.title,
          assigneeName: t.assignedTo?.fullName ?? 'Bilinmeyen',
          dueDate: t.dueDate!,
        }));
        await this.notificationService.notifyOverdueTasks(assocId, formatted);
      } catch (err) {
        this.logger.warn(`Overdue notification failed for ${assocId}: ${(err as Error).message}`);
      }
    }
  }
}
