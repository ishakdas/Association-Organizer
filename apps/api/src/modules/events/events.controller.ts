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
import { SuggestIslamicEventsDto } from './dto/suggest-islamic-events.dto';
import { SaveSuggestionDto } from './dto/save-suggestion.dto';
import { FeedbackSuggestionDto } from './dto/feedback-suggestion.dto';

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

  // Islamic event suggestions
  @Post('suggest-islamic')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  suggestIslamic(
    @Param('associationId') associationId: string,
    @Body() body: SuggestIslamicEventsDto,
    @CurrentUser() user: RequestUser,
    @Query('creative') creative?: string,
  ) {
    return this.service.suggestIslamicEvents(associationId, body, user, creative === 'true');
  }

  // Saved suggestions
  @Post('suggestions/:suggestionId/save')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  saveSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Body() body: SaveSuggestionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveSuggestion(user.id, suggestionId, body.note);
  }

  @Delete('suggestions/:suggestionId/save')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  unsaveSuggestion(
    @Param('suggestionId') suggestionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.unsaveSuggestion(user.id, suggestionId);
  }

  @Get('saved-suggestions')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  listSavedSuggestions(@CurrentUser() user: RequestUser) {
    return this.service.listSavedSuggestions(user.id);
  }

  // Feedback
  @Post('suggestions/:suggestionId/feedback')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  addFeedback(
    @Param('suggestionId') suggestionId: string,
    @Body() body: FeedbackSuggestionDto,
  ) {
    return this.service.addFeedback(suggestionId, body.rating, body.isHelpful, body.comment);
  }

  // Event program items
  @Post(':id/program')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  addProgramToEvent(
    @Param('associationId') associationId: string,
    @Param('id') eventId: string,
    @Body() body: { items: Array<{ startTime: string; duration: string; title: string; description?: string; order?: number }> },
  ) {
    return this.service.addProgramToEvent(associationId, eventId, body.items);
  }

  @Get(':id/program')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getEventProgram(
    @Param('associationId') associationId: string,
    @Param('id') eventId: string,
  ) {
    return this.service.getEventProgram(associationId, eventId);
  }

  // External events from Gebze municipality
  @Get('external-events/gebze')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  listGebzeExternalEvents(@Param('associationId') associationId: string) {
    return this.service.listGebzeExternalEvents(associationId);
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
