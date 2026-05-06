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
import { ListMyTasksQueryDto } from './dto/list-my-tasks-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

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

  @Post('prioritize')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  prioritize(
    @Param('associationId') associationId: string,
  ) {
    return this.service.prioritizeTasks(associationId);
  }

  @Get(':taskId/activities')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  activities(
    @Param('associationId') associationId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.listActivities(associationId, taskId, user);
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

  @Patch(':taskId')
  update(
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(taskId, body, user);
  }

  @Post(':taskId/resolve-dispute')
  resolveDispute(
    @Param('taskId') taskId: string,
    @Body() body: ResolveDisputeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.resolveDispute(taskId, body, user);
  }
}

/**
 * Cross-association list for the global Görevler page. The visible set
 * is derived from `request.user.memberships`; no role decorator is
 * needed because the service narrows by membership/role internally.
 */
@Controller('tasks/me')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class MyTasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  list(
    @Query() query: ListMyTasksQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.listForUser(query, user);
  }
}
