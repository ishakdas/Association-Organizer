import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { AiService } from './ai.service';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is required');
        }
        return new OpenAiProvider(apiKey);
      },
    },
    AiService,
  ],
  exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
