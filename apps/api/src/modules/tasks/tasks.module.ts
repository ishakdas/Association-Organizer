import { Module } from '@nestjs/common';
import { BotModule } from 'bot';
import { AiModule } from '@ticketbot/ai';
import {
  MyTasksController,
  TasksController,
  TaskStatusController,
} from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskNotificationService } from './task-notification.service';
import { OverdueTaskChecker } from './overdue-task-checker.service';
import { JobsModule } from '../jobs/jobs.module';
import { TasksBotIntegration } from './tasks-bot.integration';
import { IcsTokenService } from './ics-token.service';
import { TaskIcsController } from './ics.controller';

@Module({
  imports: [JobsModule, BotModule, AiModule],
  controllers: [
    TasksController,
    TaskStatusController,
    MyTasksController,
    TaskIcsController,
  ],
  providers: [TasksService, TaskNotificationService, OverdueTaskChecker, TasksBotIntegration, IcsTokenService],
  exports: [TasksService, TaskNotificationService],
})
export class TasksModule {}
