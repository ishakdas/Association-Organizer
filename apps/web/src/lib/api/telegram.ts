import { apiClient } from './client';

export interface TelegramLinkCode {
  token: string;
  expiresAt: string;
}

export function generateTelegramLink(token: string) {
  return apiClient<TelegramLinkCode>('/auth/telegram-link', {
    token,
    method: 'POST',
  });
}

export function unlinkTelegramAccount(token: string) {
  return apiClient<{ unlinked: boolean }>('/auth/telegram-link', {
    token,
    method: 'DELETE',
  });
}
