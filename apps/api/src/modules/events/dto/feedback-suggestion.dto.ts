import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const feedbackSuggestionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  isHelpful: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
});

export class FeedbackSuggestionDto extends createZodDto(feedbackSuggestionSchema) {}
