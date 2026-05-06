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
import { MeetingsService } from './meetings.service';
import { CreateMeetingNoteDto } from './dto/create-meeting-note.dto';
import { UpdateMeetingNoteDto } from './dto/update-meeting-note.dto';
import { AnalyzeMeetingContentDto } from './dto/analyze-meeting-content.dto';
import { SummarizeMeetingContentDto } from './dto/summarize-meeting-content.dto';
import { SuggestAgendaDto } from './dto/suggest-agenda.dto';
import { ListMeetingNotesQueryDto } from './dto/list-meeting-notes-query.dto';

/**
 * Per-association meeting endpoints. AssociationRolesGuard enforces
 * that the caller has an active membership in :associationId with one
 * of the listed roles (SYSTEM_ADMIN bypasses).
 */
@Controller('associations/:associationId/meetings')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Post('analyze')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  analyze(
    @Param('associationId') associationId: string,
    @Body() body: AnalyzeMeetingContentDto,
  ) {
    return this.service.analyzeContent(associationId, body.content);
  }

  @Post('summarize')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  summarize(
    @Param('associationId') associationId: string,
    @Body() body: SummarizeMeetingContentDto,
  ) {
    return this.service.summarizeMeeting(associationId, body.content);
  }

  @Post('suggest-agenda')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  suggestAgenda(
    @Param('associationId') associationId: string,
    @Body() body: SuggestAgendaDto,
  ) {
    return this.service.suggestAgenda(associationId, body.content);
  }

  @Post()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  create(
    @Param('associationId') associationId: string,
    @Body() body: CreateMeetingNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(associationId, body, user);
  }

  @Patch(':meetingId')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
  )
  update(
    @Param('associationId') associationId: string,
    @Param('meetingId') meetingId: string,
    @Body() body: UpdateMeetingNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(associationId, meetingId, body, user);
  }

  @Get()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  list(
    @Param('associationId') associationId: string,
    @Query() query: ListMeetingNotesQueryDto,
  ) {
    return this.service.list(associationId, query);
  }
}

/**
 * Detail GET lives outside the /associations prefix because the URL only
 * carries the meeting id; authorization is derived inside the service
 * from the meeting's association.
 */
@Controller('meetings')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class MeetingDetailController {
  constructor(private readonly service: MeetingsService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user);
  }
}
