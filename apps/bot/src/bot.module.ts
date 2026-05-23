import { Module } from '@nestjs/common';
import { AiModule } from '@ticketbot/ai';
import { BotService } from './bot.service';

@Module({
  imports: [AiModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
