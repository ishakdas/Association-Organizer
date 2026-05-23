import { Logger, Module, ServiceUnavailableException } from '@nestjs/common';
import { AI_PROVIDER, AiProviderConfig } from './ai-provider.interface';
import { GenericAiProvider, GenericAiProviderConfig } from './providers/generic.provider';
import { AiService } from './ai.service';

// Stub used when AI_API_KEY is not configured. The API process still
// boots (so unrelated endpoints work); only the AI-dependent endpoints
// surface a clear 503 explaining the missing configuration. Callers
// should handle ServiceUnavailableException gracefully.
class UnconfiguredAiProvider {
  async generateStructured(): Promise<never> {
    throw new ServiceUnavailableException(
      'Yapay zeka servisi yapılandırılmamış (AI_API_KEY eksik). Lütfen yöneticiyle iletişime geçin.',
    );
  }
}

const PROVIDER_PRESETS: Record<string, { baseURL: string; defaultModel: string }> = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  deepinfra: {
    baseURL: 'https://api.deepinfra.com/v1/openai',
    defaultModel: 'anthropic/claude-4-sonnet',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
  },
};

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: () => {
        const logger = new Logger('AiModule');
        const apiKey = process.env.AI_API_KEY ?? process.env.GROQ_API_KEY;

        if (!apiKey) {
          logger.warn(
            'AI_API_KEY (or GROQ_API_KEY) is not set — AI-dependent endpoints will return 503 until configured.',
          );
          return new UnconfiguredAiProvider();
        }

        const presetName = (process.env.AI_PROVIDER_TYPE ?? 'groq').toLowerCase();
        const preset = PROVIDER_PRESETS[presetName];

        const baseURL = process.env.AI_PROVIDER_BASE_URL ?? preset?.baseURL;
        if (!baseURL) {
          logger.error(
            `Unknown AI_PROVIDER_TYPE "${presetName}" and no AI_PROVIDER_BASE_URL set. AI endpoints will return 503.`,
          );
          return new UnconfiguredAiProvider();
        }

        const model =
          process.env.AI_MODEL ??
          preset?.defaultModel ??
          'llama-3.3-70b-versatile';

        const aiConfig: GenericAiProviderConfig = {
          apiKey,
          baseURL,
          model,
          temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : undefined,
          maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : undefined,
        };

        logger.log(`AI provider: ${presetName} (${baseURL}) — model: ${model}`);
        return new GenericAiProvider(aiConfig);
      },
    },
    AiService,
  ],
  exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
