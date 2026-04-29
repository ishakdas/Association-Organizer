import {
  Body,
  Controller,
  Delete,
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
import { EventRolesService } from './event-roles.service';
import { CreateEventRoleDto } from './dto/create-event-role.dto';
import { UpdateEventRoleDto } from './dto/update-event-role.dto';
import { ListEventRolesQueryDto } from './dto/list-event-roles-query.dto';

@Controller('associations/:associationId/event-roles')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class EventRolesController {
  constructor(private readonly service: EventRolesService) {}

  @Post()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  create(
    @Param('associationId') associationId: string,
    @Body() body: CreateEventRoleDto,
  ) {
    return this.service.create(associationId, body);
  }

  @Get()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  list(
    @Param('associationId') associationId: string,
    @Query() query: ListEventRolesQueryDto,
  ) {
    return this.service.list(associationId, query);
  }

  @Get(':id')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  get(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
  ) {
    return this.service.get(associationId, id);
  }

  @Patch(':id')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  update(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
    @Body() body: UpdateEventRoleDto,
  ) {
    return this.service.update(associationId, id, body);
  }

  @Delete(':id')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  remove(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
  ) {
    return this.service.softDelete(associationId, id);
  }
}
