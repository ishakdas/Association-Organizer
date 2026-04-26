import { z } from 'zod';
import { parsePhoneE164 } from '../helpers/phone';

const profilePhoneSchema = z
  .string()
  .trim()
  .max(32)
  .nullable()
  .optional()
  .transform((raw, ctx) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    const e164 = parsePhoneE164(raw);
    if (!e164) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Geçerli bir telefon numarası girin',
      });
      return z.NEVER;
    }
    return e164;
  });

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: profilePhoneSchema,
  })
  .refine((v) => v.fullName !== undefined || v.phone !== undefined, {
    message: 'En az bir alan değiştirilmeli',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const listAdminUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const listAdminAssociationsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  includeDeleted: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminAssociationsQuery = z.infer<
  typeof listAdminAssociationsQuerySchema
>;

export const adminUserResponseSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  supabaseUserId: z.string().nullable(),
  isActive: z.boolean(),
  isSystemAdmin: z.boolean(),
  createdAt: z.string(),
});
export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;

export const adminAssociationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  taxNumber: z.string().nullable(),
  city: z.string(),
  district: z.string(),
  isActive: z.boolean(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminAssociationResponse = z.infer<
  typeof adminAssociationResponseSchema
>;

export const adminLinkTokenResponseSchema = z.object({
  id: z.string(),
  token: z.string(),
  userId: z.string(),
  userFullName: z.string(),
  userEmail: z.string().nullable(),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  isExpired: z.boolean(),
  createdAt: z.string(),
});
export type AdminLinkTokenResponse = z.infer<
  typeof adminLinkTokenResponseSchema
>;
