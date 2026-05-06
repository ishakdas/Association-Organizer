import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  isHelpful: z.boolean().optional(),
  comment: z.string().optional(),
  likedCategories: z.array(z.string()).optional(),
  dislikedCategories: z.array(z.string()).optional(),
});

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
