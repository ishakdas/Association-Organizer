import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BotModule } from 'bot';
import { EVENT_REMINDERS_QUEUE, TASK_REMINDERS_QUEUE } from './jobs.constants';
import { TaskReminderScheduler } from './task-reminder.scheduler';
import { TaskReminderProcessor } from './processors/task-reminder.processor';
import { EventReminderScheduler } from './event-reminder.scheduler';
import { EventReminderProcessor } from './processors/event-reminder.processor';

export { TASK_REMINDERS_QUEUE, EVENT_REMINDERS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('redis.url')!);
        const isTls = url.protocol === 'rediss:';
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password
              ? decodeURIComponent(url.password)
              : undefined,
            // BullMQ + Upstash requirements: null retries so blocking
            // commands don't bail, no ready check since Upstash limits INFO.
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            // TLS for `rediss://` URLs (Upstash defaults to TLS).
            ...(isTls ? { tls: { servername: url.hostname } } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE }),
    BullModule.registerQueue({ name: EVENT_REMINDERS_QUEUE }),
    BotModule,
  ],
  providers: [
    TaskReminderScheduler,
    TaskReminderProcessor,
    EventReminderScheduler,
    EventReminderProcessor,
  ],
  exports: [TaskReminderScheduler, EventReminderScheduler, BullModule],
})
export class JobsModule {}
