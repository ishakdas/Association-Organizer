import { apiClient } from './client';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

export function getMe(token: string) {
  return apiClient<AuthenticatedUser>('/auth/me', { token });
}

export function completeOnboarding(token: string) {
  return apiClient<{ completedAt: string }>('/auth/complete-onboarding', {
    token,
    method: 'POST',
  });
}
