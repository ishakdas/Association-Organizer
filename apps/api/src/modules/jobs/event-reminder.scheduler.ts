import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EVENT_REMINDERS_QUEUE } from './jobs.constants';

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
    @InjectQueue(EVENT_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async scheduleEvent(event: SchedulableEvent): Promise<void> {
    const delay = event.notifyAt.getTime() - Date.now();
    if (delay <= 0) {
      this.logger.warn(
        `Event ${event.id}: notifyAt ${event.notifyAt.toISOString()} is in the past; skipping schedule`,
      );
      return;
    }
    await this.addJob(this.jobId(event.id), { eventId: event.id }, delay);
  }

  async cancelEvent(eventId: string): Promise<void> {
    await this.safeRemove(this.jobId(eventId));
  }

  async rescheduleEvent(event: SchedulableEvent): Promise<void> {
    await this.cancelEvent(event.id);
    await this.scheduleEvent(event);
  }

  async scheduleNextOccurrence(eventId: string, nextAt: Date): Promise<void> {
    const delay = nextAt.getTime() - Date.now();
    if (delay <= 0) return;
    await this.safeRemove(this.jobId(eventId));
    await this.addJob(this.jobId(eventId), { eventId }, delay);
  }

  private jobId(eventId: string): string {
    return `event-${eventId}`;
  }

  private async addJob(
    jobId: string,
    data: EventReminderJobData,
    delay: number,
  ): Promise<void> {
    await this.queue.add('NOTIFY', data, {
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
