import { Module } from '@nestjs/common';
import { BotModule } from 'bot';
import { EVENT_REMINDERS_QUEUE, TASK_REMINDERS_QUEUE } from './jobs.constants';
import { PgBossService } from './pgboss.service';
import { TaskReminderScheduler } from './task-reminder.scheduler';
import { TaskReminderProcessor } from './processors/task-reminder.processor';
import { EventReminderScheduler } from './event-reminder.scheduler';
import { EventReminderProcessor } from './processors/event-reminder.processor';
import { PendingUserCleanupService } from './pending-user-cleanup.service';

export { TASK_REMINDERS_QUEUE, EVENT_REMINDERS_QUEUE };

@Module({
  imports: [BotModule],
  providers: [
    PgBossService,
    TaskReminderScheduler,
    TaskReminderProcessor,
    EventReminderScheduler,
    EventReminderProcessor,
    PendingUserCleanupService,
  ],
  exports: [TaskReminderScheduler, EventReminderScheduler],
})
export class JobsModule {}
