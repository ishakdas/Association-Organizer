import { z } from 'zod';

export const taskStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type TaskStatusValue = z.infer<typeof taskStatusEnum>;

export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type TaskPriorityValue = z.infer<typeof taskPriorityEnum>;

export const reminderFrequencyEnum = z.enum([
  'NONE',
  'ONCE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
]);
export type ReminderFrequencyValue = z.infer<typeof reminderFrequencyEnum>;

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' });

export const createTaskSchema = z
  .object({
    title: z.string().min(2, 'En az 2 karakter').max(200),
    description: z.string().max(2000).optional(),
    assignedToUserId: z.string().cuid('Geçersiz kullanıcı'),
    watcherUserId: z.string().cuid('Geçersiz kullanıcı').optional(),
    priority: taskPriorityEnum.default('MEDIUM'),
    dueDate: isoDateTime.optional(),
    reminderAt: isoDateTime.optional(),
    reminderFrequency: reminderFrequencyEnum.default('NONE'),
  })
  .superRefine((v, ctx) => {
    if (v.reminderAt && v.dueDate && v.reminderAt > v.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma tarihi bitiş tarihinden önce olmalı',
      });
    }
    if (v.reminderFrequency !== 'NONE' && !v.reminderAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma için tarih girin',
      });
    }
  });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskStatusSchema = z.object({
  status: taskStatusEnum,
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().min(2, 'En az 2 karakter').max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    assignedToUserId: z.string().cuid('Geçersiz kullanıcı').optional(),
    watcherUserId: z.string().cuid('Geçersiz kullanıcı').nullable().optional(),
    priority: taskPriorityEnum.optional(),
    dueDate: isoDateTime.nullable().optional(),
    reminderAt: isoDateTime.nullable().optional(),
    reminderFrequency: reminderFrequencyEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmeli',
  })
  .superRefine((v, ctx) => {
    if (v.reminderAt && v.dueDate && v.reminderAt > v.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma tarihi bitiş tarihinden önce olmalı',
      });
    }
    if (
      v.reminderFrequency &&
      v.reminderFrequency !== 'NONE' &&
      v.reminderAt === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma için tarih girin',
      });
    }
  });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const resolveDisputeSchema = z.object({
  assignedToUserId: z.string().cuid('Geçersiz kullanıcı'),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

const emptyToUndefined = z.literal('').transform(() => undefined);

export const listTasksQuerySchema = z.object({
  status: taskStatusEnum.or(emptyToUndefined).optional(),
  assignedToUserId: z.string().cuid().or(emptyToUndefined).optional(),
  priority: taskPriorityEnum.or(emptyToUndefined).optional(),
  search: z.string().max(200).or(emptyToUndefined).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'title']).or(emptyToUndefined).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).or(emptyToUndefined).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const listMyTasksQuerySchema = z.object({
  associationId: z.string().cuid().or(emptyToUndefined).optional(),
  status: taskStatusEnum.or(emptyToUndefined).optional(),
  priority: taskPriorityEnum.or(emptyToUndefined).optional(),
  search: z.string().max(200).or(emptyToUndefined).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'title']).or(emptyToUndefined).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).or(emptyToUndefined).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListMyTasksQuery = z.infer<typeof listMyTasksQuerySchema>;

export const extractTasksFromMeetingSchema = z.object({
  meetingNoteId: z.string().cuid('Geçersiz toplantı'),
});
export type ExtractTasksFromMeetingInput = z.infer<typeof extractTasksFromMeetingSchema>;

const taskActorSchema = z.object({
  id: z.string(),
  fullName: z.string(),
});

export const taskResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assignedToUserId: z.string(),
  assignedById: z.string(),
  assignedBy: taskActorSchema,
  watcherUserId: z.string().nullable(),
  watcher: taskActorSchema.nullable(),
  status: taskStatusEnum,
  priority: taskPriorityEnum,
  dueDate: z.string().nullable(),
  reminderAt: z.string().nullable(),
  reminderFrequency: reminderFrequencyEnum,
  notifiedViaTelegram: z.boolean(),
  lastNotifiedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  disputed: z.boolean().default(false),
  disputedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  durationHours: z.number().nullable(),
  workloadWarning: z.string().nullable(),
});
export type TaskResponse = z.infer<typeof taskResponseSchema>;

export const taskActivityActionEnum = z.enum([
  'CREATED',
  'REASSIGNED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'DUE_DATE_CHANGED',
  'DESCRIPTION_CHANGED',
  'TITLE_CHANGED',
  'REMINDER_CHANGED',
  'REMINDER_SENT',
  'ASSIGNED_NOTIFIED',
  'ASSIGNMENT_ACCEPTED',
  'REASSIGNMENT_REQUESTED',
  'REASSIGNMENT_RESOLVED',
  'EXTRACTED_FROM_MEETING',
]);
export type TaskActivityActionValue = z.infer<typeof taskActivityActionEnum>;

export const taskActivitySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  action: taskActivityActionEnum,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  actor: taskActorSchema,
});
export type TaskActivity = z.infer<typeof taskActivitySchema>;

export const myTaskItemSchema = taskResponseSchema.extend({
  association: z.object({
    id: z.string(),
    name: z.string(),
  }),
  assignee: z.object({
    id: z.string(),
    fullName: z.string(),
  }),
});
export type MyTaskItem = z.infer<typeof myTaskItemSchema>;
