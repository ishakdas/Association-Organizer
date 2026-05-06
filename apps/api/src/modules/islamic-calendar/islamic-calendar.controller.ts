import { Controller, Get, Param } from '@nestjs/common';
import { IslamicCalendarService } from './islamic-calendar.service';

@Controller('associations/:associationId/islamic-calendar')
export class IslamicCalendarController {
  constructor(private readonly service: IslamicCalendarService) {}

  @Get('upcoming')
  getUpcomingHolidays() {
    return this.service.getCalendarInfo();
  }
}
