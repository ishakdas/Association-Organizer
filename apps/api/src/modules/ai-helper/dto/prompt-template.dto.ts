import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPromptTemplateSchema = z.object({
  key: z.string().min(1),
  content: z.string().min(1),
  version: z.number().int().min(1).optional(),
});

export const updatePromptTemplateSchema = z.object({
  content: z.string().min(1),
  isActive: z.boolean().optional(),
});

export class CreatePromptTemplateDto extends createZodDto(createPromptTemplateSchema) {}
export class UpdatePromptTemplateDto extends createZodDto(updatePromptTemplateSchema) {}
