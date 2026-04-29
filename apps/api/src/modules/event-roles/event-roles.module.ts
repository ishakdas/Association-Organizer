import { Module } from '@nestjs/common';
import { PrismaModule } from '@ticketbot/database';
import { EventRolesController } from './event-roles.controller';
import { EventRolesService } from './event-roles.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventRolesController],
  providers: [EventRolesService],
  exports: [EventRolesService],
})
export class EventRolesModule {}
