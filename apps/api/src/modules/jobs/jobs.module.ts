import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BotModule } from 'bot';
import { TASK_REMINDERS_QUEUE } from './jobs.constants';
import { TaskReminderScheduler } from './task-reminder.scheduler';
import { TaskReminderProcessor } from './processors/task-reminder.processor';

export { TASK_REMINDERS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('redis.url')!);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE }),
    BotModule,
  ],
  providers: [TaskReminderScheduler, TaskReminderProcessor],
  exports: [TaskReminderScheduler, BullModule],
})
export class JobsModule {}
