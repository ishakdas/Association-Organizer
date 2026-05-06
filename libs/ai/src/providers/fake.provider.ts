import { AiProvider, GenerateStructuredOptions, GenerateTextOptions } from '../ai-provider.interface';

export class FakeAiProvider implements AiProvider {
  private responses = new Map<string, unknown>();
  private textResponses = new Map<string, string>();

  setResponse(schemaName: string, response: unknown) {
    this.responses.set(schemaName, response);
  }

  setTextResponse(key: string, response: string) {
    this.textResponses.set(key, response);
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const response = this.responses.get(options.schemaName);
    if (!response) {
      throw new Error(`FakeAiProvider: no response configured for schema "${options.schemaName}"`);
    }
    return options.schema.parse(response);
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const key = `${options.systemPrompt.slice(0, 20)}_${options.userPrompt.slice(0, 20)}`;
    const response = this.textResponses.get(key);
    if (response) return response;
    return 'Fake text response';
  }
}
