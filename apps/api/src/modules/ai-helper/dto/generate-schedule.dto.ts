import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const generateScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  islamicSession: z.object({
    title: z.string(),
    description: z.string(),
    duration: z.string(),
  }),
  timeRange: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
});

export class GenerateScheduleDto extends createZodDto(generateScheduleSchema) {}
