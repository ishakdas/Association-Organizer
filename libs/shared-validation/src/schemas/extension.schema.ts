import { z } from 'zod';

export const createExtensionRequestSchema = z.object({
  ticketId: z.string().cuid(),
  requestedDeadline: z.string().datetime(),
  reason: z.string().min(1).max(2000),
});
export type CreateExtensionRequestInput = z.infer<typeof createExtensionRequestSchema>;

export const resolveExtensionRequestSchema = z.object({
  approved: z.boolean(),
});
export type ResolveExtensionRequestInput = z.infer<typeof resolveExtensionRequestSchema>;
