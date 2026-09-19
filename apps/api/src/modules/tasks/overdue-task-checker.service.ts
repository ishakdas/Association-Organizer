import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService, TaskStatus } from '@ticketbot/database';
import { TaskNotificationService } from './task-notification.service';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';

const BATCH_SIZE = 50;

@Injectable()
export class OverdueTaskChecker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OverdueTaskChecker.name);
  private enabled = false;
  private cronJob?: CronJob;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: TaskNotificationService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Varsayılan AÇIK: süresi geçen görev + çözülmemiş itiraz hatırlatması
    // ürünün temel davranışı, opsiyonel bir eklenti değil. Yalnızca API
    // birden fazla instance olarak ölçeklenirse, çift bildirim olmasın diye
    // yan kopyalarda ENABLE_OVERDUE_CHECKER='false' ile kapatılır.
    this.enabled = this.config.get<boolean>('jobs.overdueCheckerEnabled') ?? false;
    if (this.enabled) {
      this.logger.log('Overdue task digest enabled (daily at 09:00 Europe/Istanbul)');
      this.cronJob = new CronJob(
        '0 9 * * *',
        () =>
          this.runDailyDigest().catch((err) => {
            this.logger.error('Daily task digest failed', err as Error);
          }),
        null,
        false,
        'Europe/Istanbul',
      );
      this.cronJob.start();
    }
  }

  onModuleDestroy() {
    this.cronJob?.stop();
  }

  private async runDailyDigest(): Promise<void> {
    await this.checkOverdueTasks();
    await this.checkUnresolvedDisputes();
  }

  async checkOverdueTasks(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Checking for overdue tasks...');

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueDate: { lt: now },
        OR: [{ overdueEscalatedAt: null }, { overdueEscalatedAt: { lt: oneDayAgo } }],
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
        await this.prisma.task.updateMany({
          where: { id: { in: tasks.map((task) => task.id) } },
          data: { overdueEscalatedAt: now },
        });
      } catch (err) {
        this.logger.warn(`Overdue notification failed for ${assocId}: ${(err as Error).message}`);
      }
    }
  }

  // İki gündür çözülmemiş itirazları günlük özete alır. Bir günlük pencere,
  // her itirazın tam bir kez eskale edilmesini sağlar; itiraz anında ayrıca
  // atayan kişiye anlık Telegram mesajı gider.
  async checkUnresolvedDisputes(): Promise<void> {
    if (!this.enabled) return;

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const upper = new Date(now - 2 * DAY);
    const lower = new Date(now - 3 * DAY);

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
