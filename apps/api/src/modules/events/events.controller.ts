import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import type { FastifyReply } from 'fastify';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { EventPdfService } from './event-pdf.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { AddEventAssignmentDto } from './dto/add-assignment.dto';
import { UpdateEventAssignmentDto } from './dto/update-assignment.dto';

@Controller('associations/:associationId/events')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class EventsController {
  constructor(
    private readonly service: EventsService,
    private readonly pdf: EventPdfService,
  ) {}

  @Post()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  create(
    @Param('associationId') associationId: string,
    @Body() body: CreateEventDto,
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
    @Query() query: ListEventsQueryDto,
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
    @Body() body: UpdateEventDto,
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

  // Assignments

  @Post(':id/assignments')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  addAssignment(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
    @Body() body: AddEventAssignmentDto,
  ) {
    return this.service.addAssignment(associationId, id, body);
  }

  @Patch(':id/assignments/:assignmentId')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  updateAssignment(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateEventAssignmentDto,
  ) {
    return this.service.updateAssignment(associationId, id, assignmentId, body);
  }

  @Delete(':id/assignments/:assignmentId')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  removeAssignment(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.service.removeAssignment(associationId, id, assignmentId);
  }

  // PDF — sorumluluk listesi
  @Get(':id/pdf')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  async downloadPdf(
    @Param('associationId') associationId: string,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const event = await this.service.get(associationId, id);
    const buffer = await this.pdf.renderResponsibilityList(event);
    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="etkinlik-${id}.pdf"`,
      )
      .send(buffer);
  }
}
