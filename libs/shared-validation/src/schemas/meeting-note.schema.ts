import { z } from 'zod';

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' });

export const preApprovedTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  dueDate: isoDateTime.nullable().optional(),
});
export type PreApprovedTask = z.infer<typeof preApprovedTaskSchema>;

export const analyzeMeetingContentSchema = z.object({
  content: z.string().min(1).max(50000),
});
export type AnalyzeMeetingContentInput = z.infer<typeof analyzeMeetingContentSchema>;

export const createMeetingNoteSchema = z.object({
  title: z.string().min(2, 'En az 2 karakter').max(255),
  content: z.string().min(1).max(50000),
  meetingDate: isoDateTime,
  attendeeUserIds: z
    .array(z.string().cuid('Geçersiz kullanıcı'))
    .min(1, 'En az bir katılımcı gerekli')
    .max(500),
  preApprovedTasks: z.array(preApprovedTaskSchema).optional(),
});
export type CreateMeetingNoteInput = z.infer<typeof createMeetingNoteSchema>;

export const updateMeetingNoteSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  content: z.string().min(1).max(50000).optional(),
  meetingDate: isoDateTime.optional(),
  attendeeUserIds: z
    .array(z.string().cuid('Geçersiz kullanıcı'))
    .min(1, 'En az bir katılımcı gerekli')
    .max(500)
    .optional(),
});
export type UpdateMeetingNoteInput = z.infer<typeof updateMeetingNoteSchema>;

export const listMeetingNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMeetingNotesQuery = z.infer<typeof listMeetingNotesQuerySchema>;

export const meetingNoteResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  content: z.string(),
  meetingDate: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attendees: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      user: z.object({
        id: z.string(),
        fullName: z.string(),
        email: z.string().nullable(),
      }),
    }),
  ),
});
export type MeetingNoteResponse = z.infer<typeof meetingNoteResponseSchema>;
