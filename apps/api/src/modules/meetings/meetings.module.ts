import { Module } from '@nestjs/common';
import {
  MeetingsController,
  MeetingDetailController,
} from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  controllers: [MeetingsController, MeetingDetailController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
