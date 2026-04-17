import { z } from 'zod';

export const createMeetingNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
});
export type CreateMeetingNoteInput = z.infer<typeof createMeetingNoteSchema>;

export const updateMeetingNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(50000).optional(),
});
export type UpdateMeetingNoteInput = z.infer<typeof updateMeetingNoteSchema>;
