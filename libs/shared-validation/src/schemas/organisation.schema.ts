import { z } from 'zod';

const roleValues = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'] as const;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrganisationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(slugPattern, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
});
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(3).max(40).regex(slugPattern).optional(),
});
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(roleValues).default('MEMBER'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(roleValues),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
