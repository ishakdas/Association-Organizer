import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AiProvider, GenerateStructuredOptions } from '../ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const { systemPrompt, userPrompt, schema, schemaName } = options;
    const model = options.model ?? 'gpt-4o-mini';

    const jsonSchema = zodToJsonSchema(schema as any, { name: schemaName, target: 'openApi3' });

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // On retry, include the parse error
      if (attempt > 0 && lastError) {
        messages.push({
          role: 'user',
          content: `The previous response failed validation: ${lastError.message}\nPlease fix the output to match the required schema.`,
        });
      }

      try {
        const response = await this.client.chat.completions.create({
          model,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              schema: jsonSchema as Record<string, unknown>,
              strict: true,
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from OpenAI');

        const parsed = JSON.parse(content);
        return schema.parse(parsed);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError!;
  }
}
