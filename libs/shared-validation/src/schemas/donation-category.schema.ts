import { z } from 'zod';

export const donationCategoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type DonationCategoryResponse = z.infer<
  typeof donationCategoryResponseSchema
>;

export const createDonationCategorySchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type CreateDonationCategoryInput = z.infer<
  typeof createDonationCategorySchema
>;

export const updateDonationCategorySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });
export type UpdateDonationCategoryInput = z.infer<
  typeof updateDonationCategorySchema
>;

export const listDonationCategoriesQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListDonationCategoriesQuery = z.infer<
  typeof listDonationCategoriesQuerySchema
>;
