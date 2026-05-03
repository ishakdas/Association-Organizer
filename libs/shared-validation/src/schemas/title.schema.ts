import { z } from 'zod';

export const titleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type TitleResponse = z.infer<typeof titleResponseSchema>;

export const createMemberTitleSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type CreateMemberTitleInput = z.infer<typeof createMemberTitleSchema>;

export const updateMemberTitleSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });
export type UpdateMemberTitleInput = z.infer<typeof updateMemberTitleSchema>;

export const listMemberTitlesQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListMemberTitlesQuery = z.infer<typeof listMemberTitlesQuerySchema>;
