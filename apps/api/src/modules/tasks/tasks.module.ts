import { Module } from '@nestjs/common';
import { BotModule } from 'bot';
import {
  MyTasksController,
  TasksController,
  TaskStatusController,
} from './tasks.controller';
import { TasksService } from './tasks.service';
import { JobsModule } from '../jobs/jobs.module';
import { TasksBotIntegration } from './tasks-bot.integration';

@Module({
  imports: [JobsModule, BotModule],
  controllers: [TasksController, TaskStatusController, MyTasksController],
  providers: [TasksService, TasksBotIntegration],
  exports: [TasksService],
})
export class TasksModule {}
