import { Module } from '@nestjs/common';
import { AiModule } from '@ticketbot/ai';
import { PrismaModule } from '@ticketbot/database';
import { AiHelperController } from './ai-helper.controller';
import { AiHelperService } from './ai-helper.service';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [AiHelperController],
  providers: [AiHelperService],
})
export class AiHelperModule {}
