import { Module } from '@nestjs/common';
import { AiModule } from '@ticketbot/ai';
import {
  MeetingsController,
  MeetingDetailController,
} from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AiModule, PermissionsModule],
  controllers: [MeetingsController, MeetingDetailController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
