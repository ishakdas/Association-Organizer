import { z } from 'zod';
import { parsePhoneE164 } from '../helpers/phone';
import { TAX_NUMBER_PATTERN } from '../helpers/tax-number';

const phoneSchema = z
  .string()
  .min(1, 'Telefon zorunlu')
  .transform((raw, ctx) => {
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

const foundedAtSchema = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' })
  .refine((iso) => new Date(iso) <= new Date(), {
    message: 'Kuruluş tarihi gelecekte olamaz',
  });

const optionalUrl = z
  .union([z.string().url(), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));

export const createAssociationSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().min(2).max(50).optional(),
  taxNumber: z
    .string()
    .regex(TAX_NUMBER_PATTERN, 'Vergi numarası 10 haneli ve sadece rakam olmalı'),
  foundedAt: foundedAtSchema,
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  phone: phoneSchema,
  email: z.string().email('Geçerli bir e-posta girin').max(200),
  website: optionalUrl,
  logoUrl: optionalUrl,
  activityArea: z.string().min(2).max(200),
  memberCount: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});
export type CreateAssociationInput = z.infer<typeof createAssociationSchema>;

export const updateAssociationSchema = createAssociationSchema.partial();
export type UpdateAssociationInput = z.infer<typeof updateAssociationSchema>;

export const listAssociationsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAssociationsQuery = z.infer<typeof listAssociationsQuerySchema>;

export const associationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  taxNumber: z.string(),
  foundedAt: z.string(),
  address: z.string(),
  city: z.string(),
  district: z.string(),
  phone: z.string(),
  email: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  activityArea: z.string(),
  memberCount: z.number(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AssociationResponse = z.infer<typeof associationResponseSchema>;
