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

export const reminderFrequencyEnum = z.enum(['NONE', 'DAILY', 'WEEKLY']);
export type ReminderFrequencyValue = z.infer<typeof reminderFrequencyEnum>;

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' });

export const createTaskSchema = z.object({
  title: z.string().min(2, 'En az 2 karakter').max(200),
  description: z.string().max(2000).optional(),
  assignedToUserId: z.string().cuid('Geçersiz kullanıcı'),
  priority: taskPriorityEnum.default('MEDIUM'),
  dueDate: isoDateTime.optional(),
  reminderAt: isoDateTime.optional(),
  reminderFrequency: reminderFrequencyEnum.default('NONE'),
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

export const taskResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assignedToUserId: z.string(),
  assignedById: z.string(),
  status: taskStatusEnum,
  priority: taskPriorityEnum,
  dueDate: z.string().nullable(),
  reminderAt: z.string().nullable(),
  reminderFrequency: reminderFrequencyEnum,
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskResponse = z.infer<typeof taskResponseSchema>;
