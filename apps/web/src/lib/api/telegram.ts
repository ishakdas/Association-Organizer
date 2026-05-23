import { apiClient } from './client';

export interface TelegramLinkCode {
  token: string;
  expiresAt: string;
  deepLinkUrl: string;
}

export interface TelegramLinkCodeWithEmail {
  token: string;
  expiresAt: string;
  deepLinkUrl: string;
  emailSent: boolean;
  messageId: string | null;
}

export function generateTelegramLink(token: string) {
  return apiClient<TelegramLinkCode>('/auth/telegram-link', {
    token,
    method: 'POST',
  });
}

export function generateTelegramLinkWithEmail(token: string, email: string) {
  return apiClient<TelegramLinkCodeWithEmail>('/auth/telegram-link', {
    token,
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function unlinkTelegramAccount(token: string) {
  return apiClient<{ unlinked: boolean }>('/auth/telegram-link', {
    token,
    method: 'DELETE',
  });
}
