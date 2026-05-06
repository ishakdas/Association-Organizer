import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveSuggestionSchema = z.object({
  note: z.string().max(500).optional(),
});

export class SaveSuggestionDto extends createZodDto(saveSuggestionSchema) {}
