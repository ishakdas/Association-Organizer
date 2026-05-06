import OpenAI from 'openai';
import { AiProvider, AiProviderConfig, GenerateStructuredOptions, GenerateTextOptions } from '../ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: AiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.defaultModel = config.model ?? 'llama-3.3-70b-versatile';
    this.defaultTemperature = config.temperature ?? 0.85;
    this.defaultMaxTokens = config.maxTokens ?? 2048;
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const { systemPrompt, userPrompt, schema } = options;
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? this.defaultTemperature;
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      if (attempt > 0 && lastError) {
        messages.push({
          role: 'user',
          content: `Previous response failed validation: ${lastError.message}. Fix the JSON and try again.`,
        });
      }

      try {
        const response = await this.client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');

        const parsed = JSON.parse(content);
        return schema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError!;
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const { systemPrompt, userPrompt } = options;
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? this.defaultTemperature;
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens;

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');
    return content;
  }
}
