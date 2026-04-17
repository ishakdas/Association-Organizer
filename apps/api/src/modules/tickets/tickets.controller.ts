import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TicketsService } from './tickets.service';
import {
  createTicketSchema,
  CreateTicketInput,
  updateTicketSchema,
  UpdateTicketInput,
  ticketQuerySchema,
  TicketQueryInput,
} from '@ticketbot/shared-validation';

@Controller('tickets')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createTicketSchema)) body: CreateTicketInput,
    @CurrentOrg() organisationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ticketsService.create(body, organisationId, user.id);
  }

  @Get()
  findAll(
    @Query(new ZodValidationPipe(ticketQuerySchema)) query: TicketQueryInput,
    @CurrentOrg() organisationId: string,
  ) {
    return this.ticketsService.findAll(organisationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentOrg() organisationId: string) {
    return this.ticketsService.findOne(id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) body: UpdateTicketInput,
    @CurrentOrg() organisationId: string,
  ) {
    return this.ticketsService.update(id, organisationId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentOrg() organisationId: string) {
    return this.ticketsService.softDelete(id, organisationId);
  }
}
