import { AiProvider, GenerateStructuredOptions } from '../ai-provider.interface';

export class FakeAiProvider implements AiProvider {
  private responses = new Map<string, unknown>();

  setResponse(schemaName: string, response: unknown) {
    this.responses.set(schemaName, response);
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const response = this.responses.get(options.schemaName);
    if (!response) {
      throw new Error(`FakeAiProvider: no response configured for schema "${options.schemaName}"`);
    }
    return options.schema.parse(response);
  }
}
