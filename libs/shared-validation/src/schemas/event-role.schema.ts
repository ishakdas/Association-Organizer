import { z } from 'zod';

export const createEventRoleSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(80),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type CreateEventRoleInput = z.infer<typeof createEventRoleSchema>;

export const updateEventRoleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullish(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});
export type UpdateEventRoleInput = z.infer<typeof updateEventRoleSchema>;

export const listEventRolesQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().default(false),
});
export type ListEventRolesQuery = z.infer<typeof listEventRolesQuerySchema>;

export const eventRoleResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventRoleResponse = z.infer<typeof eventRoleResponseSchema>;
