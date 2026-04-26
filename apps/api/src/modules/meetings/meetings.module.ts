import { Module } from '@nestjs/common';
import { AiModule } from '@ticketbot/ai';
import {
  MeetingsController,
  MeetingDetailController,
} from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [AiModule],
  controllers: [MeetingsController, MeetingDetailController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
