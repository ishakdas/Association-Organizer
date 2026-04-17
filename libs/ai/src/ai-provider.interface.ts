import { ZodSchema } from 'zod';

export interface GenerateStructuredOptions<T> {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
  schemaName: string;
}

export interface AiProvider {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
