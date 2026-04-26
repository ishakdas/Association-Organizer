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
    // Reminder must precede the due date — otherwise it's pointless.
    if (v.reminderAt && v.dueDate && v.reminderAt > v.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma tarihi bitiş tarihinden önce olmalı',
      });
    }
    // Recurring or one-shot reminders need at least an anchor date.
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

export const listTasksQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  assignedToUserId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// Cross-association list for the global /tasks page. The endpoint
// computes the visible set from the caller's memberships, so the
// query only carries optional narrowing filters.
export const listMyTasksQuerySchema = z.object({
  associationId: z.string().cuid().optional(),
  status: taskStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMyTasksQuery = z.infer<typeof listMyTasksQuerySchema>;

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
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskResponse = z.infer<typeof taskResponseSchema>;

// Append-only audit trail for a task. Mirrors the Prisma
// TaskActivityAction enum. The `payload` shape varies by action — kept
// permissive on the wire (`z.record(...)`) so adding a new action
// doesn't require a schema change in lock-step.
export const taskActivityActionEnum = z.enum([
  'CREATED',
  'REASSIGNED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'DUE_DATE_CHANGED',
  'DESCRIPTION_CHANGED',
  'TITLE_CHANGED',
  'REMINDER_CHANGED',
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

// Used by GET /tasks/me. Embeds association name + assignee name so
// the global Görevler page can group by association without N+1 calls.
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
