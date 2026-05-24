import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import { EVENT_REMINDERS_QUEUE } from './jobs.constants';
import { PgBossService } from './pgboss.service';

export interface EventReminderJobData {
  eventId: string;
}

export interface SchedulableEvent {
  id: string;
  notifyAt: Date;
}

@Injectable()
export class EventReminderScheduler {
  private readonly logger = new Logger(EventReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boss: PgBossService,
  ) {}

  async scheduleEvent(event: SchedulableEvent): Promise<void> {
    const delay = event.notifyAt.getTime() - Date.now();
    if (delay <= 0) {
      this.logger.warn(
        `Event ${event.id}: notifyAt ${event.notifyAt.toISOString()} is in the past; skipping schedule`,
      );
      return;
    }
    const id = await this.sendJob(event.id, event.notifyAt);
    if (id) await this.persistJobId(event.id, id);
  }

  async cancelEvent(eventId: string): Promise<void> {
    const row = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { notifyJobId: true },
    });
    if (!row?.notifyJobId) return;

    await this.boss.cancel(EVENT_REMINDERS_QUEUE, row.notifyJobId);
    await this.prisma.event.update({
      where: { id: eventId },
      data: { notifyJobId: null },
    });
  }

  async rescheduleEvent(event: SchedulableEvent): Promise<void> {
    await this.cancelEvent(event.id);
    await this.scheduleEvent(event);
  }

  async scheduleNextOccurrence(eventId: string, nextAt: Date): Promise<void> {
    const delay = nextAt.getTime() - Date.now();
    if (delay <= 0) return;

    const row = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { notifyJobId: true },
    });
    if (row?.notifyJobId) {
      await this.boss.cancel(EVENT_REMINDERS_QUEUE, row.notifyJobId);
    }

    const id = await this.sendJob(eventId, nextAt);
    if (id) await this.persistJobId(eventId, id);
  }

  private async sendJob(
    eventId: string,
    runAt: Date,
  ): Promise<string | null> {
    return this.boss.send<EventReminderJobData>(
      EVENT_REMINDERS_QUEUE,
      { eventId },
      {
        startAfter: runAt,
        retryLimit: 3,
        retryDelay: 60,
        retentionMinutes: 60,
        expireInMinutes: 15,
      },
    );
  }

  private async persistJobId(eventId: string, jobId: string): Promise<void> {
    try {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { notifyJobId: jobId },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist notifyJobId for event ${eventId}: ${(err as Error).message}`,
      );
    }
  }
}
