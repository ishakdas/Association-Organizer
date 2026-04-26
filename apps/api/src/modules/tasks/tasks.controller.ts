import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

/**
 * Per-association task endpoints. AssociationRolesGuard enforces that
 * the caller has an active membership in :associationId with one of the
 * listed roles (SYSTEM_ADMIN bypasses).
 */
@Controller('associations/:associationId/tasks')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Post()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  create(
    @Param('associationId') associationId: string,
    @Body() body: CreateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(associationId, body, user);
  }

  @Get()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  list(
    @Param('associationId') associationId: string,
    @Query() query: ListTasksQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.list(associationId, query, user);
  }
}

/**
 * Status PATCH lives outside the /associations prefix because the route
 * URL only carries the task id, not the association. Authorization is
 * derived inside the service from the task's association.
 */
@Controller('tasks')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class TaskStatusController {
  constructor(private readonly service: TasksService) {}

  @Patch(':taskId/status')
  updateStatus(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateStatus(taskId, body, user);
  }
}
