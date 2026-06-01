import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import { IslamicCalendarService } from './islamic-calendar.service';

@Controller('associations/:associationId/islamic-calendar')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
export class IslamicCalendarController {
  constructor(private readonly service: IslamicCalendarService) {}

  @Get('upcoming')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getUpcomingHolidays() {
    return this.service.getCalendarInfo();
  }
}
