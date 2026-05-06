import { ZodSchema } from 'zod';

export interface GenerateStructuredOptions<T> {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
  schemaName: string;
}

export interface GenerateTextOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  userPrompt: string;
}

export interface AiProvider {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
  generateText(options: GenerateTextOptions): Promise<string>;
}

export interface AiProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
