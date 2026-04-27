import { z } from 'zod';
import { parsePhoneE164 } from '../helpers/phone';
import { TAX_NUMBER_PATTERN } from '../helpers/tax-number';

const optionalPhoneSchema = z
  .string()
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

const managerSchema = z.object({
  fullName: z.string().min(2, 'En az 2 karakter').max(200),
  email: z.string().email('Geçerli bir e-posta girin').max(200),
  phone: optionalPhoneSchema,
});
export type CreateAssociationManagerInput = z.infer<typeof managerSchema>;

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

const optionalTaxNumberSchema = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || TAX_NUMBER_PATTERN.test(v),
    'Vergi numarası 10 haneli ve sadece rakam olmalı',
  );

const optionalAddressSchema = z
  .string()
  .max(500)
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || v.length >= 5,
    'En az 5 karakter',
  );

export const createAssociationSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().min(2).max(50).optional(),
  taxNumber: optionalTaxNumberSchema,
  foundedAt: foundedAtSchema,
  address: optionalAddressSchema,
  city: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  phone: optionalPhoneSchema,
  email: z.string().email('Geçerli bir e-posta girin').max(200),
  website: optionalUrl,
  logoUrl: optionalUrl,
  activityArea: z.string().min(2).max(200),
  memberCount: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  manager: managerSchema,
});
export type CreateAssociationInput = z.infer<typeof createAssociationSchema>;

// Update flow does NOT mutate the manager identity — manager rotation goes
// through the membership endpoints, not POST/PATCH /associations.
export const updateAssociationSchema = createAssociationSchema
  .omit({ manager: true })
  .partial();
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
  taxNumber: z.string().nullable(),
  foundedAt: z.string(),
  address: z.string().nullable(),
  city: z.string(),
  district: z.string(),
  phone: z.string().nullable(),
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
