export interface PromptTemplateLoader {
  getPrompt(key: string): Promise<string | null>;
}

export const PROMPT_TEMPLATE_LOADER = Symbol('PROMPT_TEMPLATE_LOADER');
