import { z } from 'zod';
import { taskPriorityEnum } from './task.schema';

export const extractedActionItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  assignedToUserId: z.string().nullable(),
  dueDateText: z.string().nullable(),
});

export type ExtractedActionItemOutput = z.infer<typeof extractedActionItemSchema>;

export interface EnrichedActionItem extends Omit<ExtractedActionItemOutput, 'dueDateText'> {
  dueDate: string | null;
}

export const extractionResultSchema = z.object({
  actionItems: z.array(extractedActionItemSchema),
});

export type ExtractionResultOutput = z.infer<typeof extractionResultSchema>;

export const extractedTaskItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  assigneeName: z.string().nullable(),
  priority: taskPriorityEnum.nullable(),
  dueDate: z.string().nullable(),
  originalText: z.string().nullable(),
});

export type ExtractedTaskItemOutput = z.infer<typeof extractedTaskItemSchema>;

export const extractTasksFromMeetingResultSchema = z.object({
  tasks: z.array(extractedTaskItemSchema),
});

export type ExtractTasksFromMeetingResultOutput = z.infer<typeof extractTasksFromMeetingResultSchema>;
