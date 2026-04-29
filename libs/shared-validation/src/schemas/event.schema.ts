import { z } from 'zod';

export const eventTypeEnum = z.enum([
  'CONFERENCE',
  'TALK',
  'SEMINAR',
  'IFTAR',
  'KANDIL',
  'MEETING',
  'CUSTOM',
]);
export type EventTypeValue = z.infer<typeof eventTypeEnum>;

export const recurrenceTypeEnum = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export type RecurrenceTypeValue = z.infer<typeof recurrenceTypeEnum>;

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' });

// Each assignment: a member (membershipId) + a role expressed as either a
// catalog reference (roleDefinitionId) OR an ad-hoc string (customRole).
// Exactly one of those two must be set — enforced by superRefine below.
export const eventAssignmentInputSchema = z
  .object({
    membershipId: z.string().cuid('Geçersiz üye'),
    roleDefinitionId: z.string().cuid('Geçersiz rol').optional(),
    customRole: z.string().min(2).max(80).optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const hasRoleDef = !!v.roleDefinitionId;
    const hasCustom = !!v.customRole && v.customRole.trim().length > 0;
    if (hasRoleDef && hasCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customRole'],
        message: 'Aynı anda hem rol katalogu hem de özel rol seçemezsiniz',
      });
    }
    if (!hasRoleDef && !hasCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['roleDefinitionId'],
        message: 'Bir rol seçin (katalog veya özel)',
      });
    }
  });
export type EventAssignmentInput = z.infer<typeof eventAssignmentInputSchema>;

export const createEventSchema = z
  .object({
    title: z.string().min(2, 'En az 2 karakter').max(200),
    description: z.string().max(2000).optional(),
    type: eventTypeEnum.default('CUSTOM'),
    location: z.string().max(255).optional(),
    startsAt: isoDateTime,
    endsAt: isoDateTime.optional(),
    notifyAt: isoDateTime,
    recurrenceType: recurrenceTypeEnum.default('NONE'),
    recurrenceInterval: z.coerce.number().int().min(1).max(365).default(1),
    recurrenceEndsAt: isoDateTime.optional(),
    assignments: z.array(eventAssignmentInputSchema).max(100).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Bitiş, başlangıçtan önce olamaz',
      });
    }
    if (v.notifyAt > v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notifyAt'],
        message: 'Bildirim zamanı etkinlik başlangıcından sonra olamaz',
      });
    }
    if (v.recurrenceType === 'NONE' && v.recurrenceEndsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceEndsAt'],
        message: 'Tekrar yoksa bitiş tarihi anlamlı değil',
      });
    }
    if (v.recurrenceEndsAt && v.recurrenceEndsAt < v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceEndsAt'],
        message: 'Tekrar bitişi başlangıçtan önce olamaz',
      });
    }
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).nullish(),
    type: eventTypeEnum.optional(),
    location: z.string().max(255).nullish(),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.nullish(),
    notifyAt: isoDateTime.optional(),
    recurrenceType: recurrenceTypeEnum.optional(),
    recurrenceInterval: z.coerce.number().int().min(1).max(365).optional(),
    recurrenceEndsAt: isoDateTime.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.endsAt && v.startsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Bitiş, başlangıçtan önce olamaz',
      });
    }
    if (v.notifyAt && v.startsAt && v.notifyAt > v.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notifyAt'],
        message: 'Bildirim zamanı etkinlik başlangıcından sonra olamaz',
      });
    }
  });
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const listEventsQuerySchema = z.object({
  type: eventTypeEnum.optional(),
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const updateEventAssignmentSchema = z
  .object({
    notes: z.string().max(500).nullish(),
    customRole: z.string().min(2).max(80).nullish(),
    roleDefinitionId: z.string().cuid().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.roleDefinitionId && v.customRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customRole'],
        message: 'Aynı anda hem rol katalogu hem de özel rol seçemezsiniz',
      });
    }
  });
export type UpdateEventAssignmentInput = z.infer<typeof updateEventAssignmentSchema>;

const memberSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
});

export const eventAssignmentResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  membershipId: z.string(),
  member: memberSummarySchema,
  roleDefinitionId: z.string().nullable(),
  roleDefinition: z
    .object({ id: z.string(), name: z.string() })
    .nullable(),
  customRole: z.string().nullable(),
  notes: z.string().nullable(),
  notificationSent: z.boolean(),
  notifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventAssignmentResponse = z.infer<typeof eventAssignmentResponseSchema>;

export const eventResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: eventTypeEnum,
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  notifyAt: z.string(),
  recurrenceType: recurrenceTypeEnum,
  recurrenceInterval: z.number(),
  recurrenceEndsAt: z.string().nullable(),
  notificationSent: z.boolean(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignments: z.array(eventAssignmentResponseSchema),
});
export type EventResponse = z.infer<typeof eventResponseSchema>;

export const eventListItemSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  type: eventTypeEnum,
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  notifyAt: z.string(),
  recurrenceType: recurrenceTypeEnum,
  notificationSent: z.boolean(),
  assignmentCount: z.number(),
  createdAt: z.string(),
});
export type EventListItem = z.infer<typeof eventListItemSchema>;
