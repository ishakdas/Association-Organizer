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

  // Uzun süredir (~2 gün) çözülmemiş itirazlı görevleri yöneticilere
  // hatırlatır. Saatlik cron + 1 saatlik pencere → her görev yalnızca bir
  // kez eskale edilir (şema değişikliği / spam yok). Cron kapalıyken (env)
  // çalışmaz; itiraz anında zaten takipçi/atayan bilgilendiriliyor.
  async checkUnresolvedDisputes(): Promise<void> {
    if (!this.enabled) return;

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const upper = new Date(now - 2 * DAY);
    const lower = new Date(now - 2 * DAY - 60 * 60 * 1000);

    const disputed = await this.prisma.task.findMany({
      where: {
        disputed: true,
        disputedAt: { gte: lower, lt: upper },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        deletedAt: null,
      },
      include: {
        assignedTo: { select: { fullName: true } },
      },
      take: BATCH_SIZE,
      orderBy: { disputedAt: 'asc' },
    });

    if (disputed.length === 0) return;

    this.logger.log(`Found ${disputed.length} long-unresolved disputed tasks`);

    const byAssociation = new Map<string, typeof disputed>();
    for (const task of disputed) {
      const arr = byAssociation.get(task.associationId) ?? [];
      arr.push(task);
      byAssociation.set(task.associationId, arr);
    }

    for (const [assocId, tasks] of byAssociation) {
      try {
        await this.notificationService.notifyUnresolvedDisputes(
          assocId,
          tasks.map((t) => ({
            taskId: t.id,
            title: t.title,
            assigneeName: t.assignedTo?.fullName ?? 'Bilinmeyen',
            disputedAt: t.disputedAt!,
          })),
        );
      } catch (err) {
        this.logger.warn(
          `Dispute escalation notification failed for ${assocId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
