import { Module } from '@nestjs/common';
import { BotModule } from 'bot';
import { AiModule } from '@ticketbot/ai';
import {
  MyTasksController,
  TasksController,
  TaskStatusController,
} from './tasks.controller';
import { TasksService } from './tasks.service';
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
  providers: [TasksService, TasksBotIntegration, IcsTokenService],
  exports: [TasksService],
})
export class TasksModule {}
