export interface AuthTokenPayload {
  sub: string; // userId
  email?: string;
}

export interface BotTokenPayload {
  sub: string; // userId
  telegramId: string;
}

export interface TelegramLinkTokenDto {
  token: string;
  expiresAt: string;
}
