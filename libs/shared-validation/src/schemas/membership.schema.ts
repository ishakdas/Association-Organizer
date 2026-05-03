import { z } from 'zod';
import { parsePhoneE164 } from '../helpers/phone';

const userRoleEnum = z.enum([
  'SYSTEM_ADMIN',
  'ASSOCIATION_MANAGER',
  'ASSOCIATION_SECRETARY',
  'ASSOCIATION_MEMBER',
]);
export type MembershipRole = z.infer<typeof userRoleEnum>;

const optionalPhoneSchema = z
  .string()
  .min(1)
  .optional()
  .transform((raw, ctx) => {
    if (raw === undefined || raw === '') return undefined;
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

const optionalEmail = z
  .union([z.string().email('Geçerli bir e-posta girin').max(200), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));

export const addMemberSchema = z
  .object({
    fullName: z.string().min(2, 'En az 2 karakter').max(200),
    email: optionalEmail,
    phone: optionalPhoneSchema,
    address: z.string().max(500).optional(),
    role: userRoleEnum,
    titleId: z.string().cuid('Geçersiz unvan').optional(),
    customTitle: z.string().min(2).max(100).optional(),
    password: z.string().min(8, 'En az 8 karakter').max(72).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'ASSOCIATION_SECRETARY') {
      if (!v.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'Sekreter için şifre zorunludur',
        });
      }
      if (!v.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Sekreter için e-posta zorunludur',
        });
      }
    }
  });
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z
  .object({
    role: userRoleEnum.optional(),
    titleId: z.string().cuid('Geçersiz unvan').nullable().optional(),
    customTitle: z.string().min(2).max(100).nullable().optional(),
    isActive: z.boolean().optional(),
    leftAt: z.string().datetime({ offset: true }).nullable().optional(),
    fullName: z.string().min(2).max(200).optional(),
    phone: optionalPhoneSchema,
    address: z.string().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const listMembersQuerySchema = z.object({
  role: userRoleEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const memberResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  userId: z.string(),
  role: userRoleEnum,
  titleId: z.string().nullable(),
  customTitle: z.string().nullable(),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  isActive: z.boolean(),
  user: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable().optional(),
    mustChangePassword: z.boolean().optional(),
    telegramAccount: z
      .object({
        username: z.string().nullable(),
        firstName: z.string().nullable(),
        createdAt: z.string(),
      })
      .nullable()
      .optional(),
  }),
  title: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;
