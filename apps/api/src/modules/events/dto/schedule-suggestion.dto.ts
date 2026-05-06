import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const scheduleSuggestionSchema = z.object({
  start: z.string().min(1).max(5), // "14:00"
  end: z.string().min(1).max(5),   // "17:00"
});

export class ScheduleSuggestionDto extends createZodDto(scheduleSuggestionSchema) {}
