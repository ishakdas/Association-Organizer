import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const generateSocialSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  targetAudience: z.string().min(1),
  category: z.string().min(1),
  keyTopics: z.array(z.string().min(1)),
  eventDate: z.string().min(1),
  location: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export class GenerateSocialDto extends createZodDto(generateSocialSchema) {}
