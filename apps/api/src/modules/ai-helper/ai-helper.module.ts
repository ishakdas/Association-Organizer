import { Module } from '@nestjs/common';
import { AiModule, PROMPT_TEMPLATE_LOADER } from '@ticketbot/ai';
import { PrismaModule } from '@ticketbot/database';
import { AiHelperController } from './ai-helper.controller';
import { AiHelperService } from './ai-helper.service';
import { PrismaPromptTemplateLoader } from './prisma-prompt-template.loader';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [AiHelperController],
  providers: [
    AiHelperService,
    PrismaPromptTemplateLoader,
    { provide: PROMPT_TEMPLATE_LOADER, useExisting: PrismaPromptTemplateLoader },
  ],
})
export class AiHelperModule {}
