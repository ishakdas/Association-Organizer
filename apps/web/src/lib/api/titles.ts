import { apiClient } from './client';
import type { TitleResponse } from '@ticketbot/shared-validation';

export function listTitles(token: string) {
  return apiClient<TitleResponse[]>('/titles', { token });
}
