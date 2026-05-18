import { Module } from '@nestjs/common';
import { PrismaModule } from '@ticketbot/database';
import { EmailService } from './email.service';

@Module({
  imports: [PrismaModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
