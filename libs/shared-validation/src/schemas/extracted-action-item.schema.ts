import { z } from 'zod';

export const extractedActionItemSchema = z.object({
  content: z.string().min(1),
  assigneeName: z.string().nullable().optional(),
});
export type ExtractedActionItemOutput = z.infer<typeof extractedActionItemSchema>;

export const extractionResultSchema = z.object({
  actionItems: z.array(extractedActionItemSchema),
});
export type ExtractionResultOutput = z.infer<typeof extractionResultSchema>;
