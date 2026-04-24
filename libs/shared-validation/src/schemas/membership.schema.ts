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

export const addMemberSchema = z.object({
  fullName: z.string().min(2, 'En az 2 karakter').max(200),
  email: optionalEmail,
  phone: optionalPhoneSchema,
  role: userRoleEnum,
  titleId: z.string().cuid('Geçersiz unvan').optional(),
  customTitle: z.string().min(2).max(100).optional(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

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
