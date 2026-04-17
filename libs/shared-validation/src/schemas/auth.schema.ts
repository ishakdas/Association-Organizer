import { z } from 'zod';

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
