import { z } from 'zod';

export const extractedActionItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  assignedToUserId: z.string().nullable(),
});

export type ExtractedActionItemOutput = z.infer<typeof extractedActionItemSchema>;

export const extractionResultSchema = z.object({
  actionItems: z.array(extractedActionItemSchema),
});

export type ExtractionResultOutput = z.infer<typeof extractionResultSchema>;
