import { z } from 'zod';
import { parsePhoneE164 } from '../helpers/phone';

const optionalTrPhone = z
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

export const telegramLinkRequestSchema = z.object({
  token: z.string().min(1),
});
export type TelegramLinkRequestInput = z.infer<typeof telegramLinkRequestSchema>;

export const telegramLinkRedeemSchema = z.object({
  token: z.string().min(1),
  telegramId: z.string().min(1), // BigInt serialized as string
  username: z.string().optional(),
  firstName: z.string().optional(),
});
export type TelegramLinkRedeemInput = z.infer<typeof telegramLinkRedeemSchema>;

export const botAuthPayloadSchema = z.object({
  sub: z.string(),
  telegramId: z.string(),
  organisationId: z.string().cuid(),
});
export type BotAuthPayload = z.infer<typeof botAuthPayloadSchema>;

export const requestBranchRegistrationSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin').max(200),
  fullName: z.string().min(2, 'En az 2 karakter').max(100),
  phone: optionalTrPhone,
  city: z.string().min(1, 'İl seçiniz').max(100),
  district: z.string().min(1, 'İlçe seçiniz').max(100),
  message: z.string().max(500).optional(),
});
export type RequestBranchRegistrationInput = z.infer<typeof requestBranchRegistrationSchema>;

export const approveBranchRegistrationSchema = z.object({});
export type ApproveBranchRegistrationInput = z.infer<typeof approveBranchRegistrationSchema>;

export const checkBranchEmailSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin').max(200),
});
export type CheckBranchEmailInput = z.infer<typeof checkBranchEmailSchema>;

export const resendInviteForUserSchema = z.object({
  userId: z.string().cuid('Geçersiz kullanıcı'),
});
export type ResendInviteForUserInput = z.infer<typeof resendInviteForUserSchema>;
