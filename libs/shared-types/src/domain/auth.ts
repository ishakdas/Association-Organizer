export interface AuthTokenPayload {
  sub: string; // userId
  email: string;
  organisationId?: string;
}

export interface BotTokenPayload {
  sub: string; // userId
  telegramId: string;
  organisationId: string;
}

export interface TelegramLinkTokenDto {
  token: string;
  expiresAt: string;
}
