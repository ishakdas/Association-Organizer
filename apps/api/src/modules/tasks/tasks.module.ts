import { Module } from '@nestjs/common';
import { TasksController, TaskStatusController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController, TaskStatusController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
