import OpenAI from 'openai';
import { AiProvider, GenerateStructuredOptions } from '../ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const { systemPrompt, userPrompt, schema } = options;
    const model = options.model ?? 'llama-3.3-70b-versatile';

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
}
