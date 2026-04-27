import { Module } from '@nestjs/common';
import { PrismaModule } from '@ticketbot/database';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventPdfService } from './event-pdf.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [EventsController],
  providers: [EventsService, EventPdfService],
  exports: [EventsService],
})
export class EventsModule {}
