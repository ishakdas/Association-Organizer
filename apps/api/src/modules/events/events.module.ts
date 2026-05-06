import { Module } from '@nestjs/common';
import { PrismaModule } from '@ticketbot/database';
import { AiModule } from '@ticketbot/ai';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventPdfService } from './event-pdf.service';
import { JobsModule } from '../jobs/jobs.module';
import { IslamicCalendarModule } from '../islamic-calendar/islamic-calendar.module';

@Module({
  imports: [PrismaModule, JobsModule, AiModule, IslamicCalendarModule],
  controllers: [EventsController],
  providers: [EventsService, EventPdfService],
  exports: [EventsService],
})
export class EventsModule {}
