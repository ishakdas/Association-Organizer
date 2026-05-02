import { Logger, Module, ServiceUnavailableException } from '@nestjs/common';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { AiService } from './ai.service';

// Stub used when GROQ_API_KEY is not configured. The API process still
// boots (so unrelated endpoints work); only the AI-dependent endpoints
// surface a clear 503 explaining the missing configuration. Callers
// should handle ServiceUnavailableException gracefully.
class UnconfiguredAiProvider implements AiProvider {
  async generateStructured(): Promise<never> {
    throw new ServiceUnavailableException(
      'Yapay zeka servisi yapılandırılmamış (GROQ_API_KEY eksik). Lütfen yöneticiyle iletişime geçin.',
    );
  }
}

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: () => {
        const logger = new Logger('AiModule');
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          logger.warn(
            'GROQ_API_KEY is not set — AI-dependent endpoints will return 503 until configured.',
          );
          return new UnconfiguredAiProvider();
        }
        return new OpenAiProvider(apiKey);
      },
    },
    AiService,
  ],
  exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
