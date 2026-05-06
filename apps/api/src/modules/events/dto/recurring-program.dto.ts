import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const recurringProgramSchema = z.object({
  weeks: z.number().int().min(2).max(12),
});

export class RecurringProgramDto extends createZodDto(recurringProgramSchema) {}
