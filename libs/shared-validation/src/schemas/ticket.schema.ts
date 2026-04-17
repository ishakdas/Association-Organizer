import { z } from 'zod';

const ticketStatusValues = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
] as const;

const ticketPriorityValues = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(ticketPriorityValues).default('MEDIUM'),
  assigneeId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(ticketStatusValues).optional(),
  priority: z.enum(ticketPriorityValues).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const ticketQuerySchema = z.object({
  status: z.enum(ticketStatusValues).optional(),
  priority: z.enum(ticketPriorityValues).optional(),
  assigneeId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type TicketQueryInput = z.infer<typeof ticketQuerySchema>;
