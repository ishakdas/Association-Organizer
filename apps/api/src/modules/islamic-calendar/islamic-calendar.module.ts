import { Module } from '@nestjs/common';
import { IslamicCalendarService } from './islamic-calendar.service';
import { IslamicCalendarController } from './islamic-calendar.controller';

@Module({
  providers: [IslamicCalendarService],
  controllers: [IslamicCalendarController],
  exports: [IslamicCalendarService],
})
export class IslamicCalendarModule {}
