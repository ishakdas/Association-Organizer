import { apiClient } from './client';
import type {
  DonationCategoryResponse,
  CreateDonationCategoryInput,
  UpdateDonationCategoryInput,
} from '@ticketbot/shared-validation';

export function listDonationCategories(token: string) {
  return apiClient<DonationCategoryResponse[]>('/donation-categories', {
    token,
  });
}

export function listAdminDonationCategories(token: string) {
  return apiClient<DonationCategoryResponse[]>(
    '/donation-categories?includeInactive=true',
    { token },
  );
}

export function createDonationCategory(
  token: string,
  input: CreateDonationCategoryInput,
) {
  return apiClient<DonationCategoryResponse>('/donation-categories', {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDonationCategory(
  token: string,
  id: string,
  input: UpdateDonationCategoryInput,
) {
  return apiClient<DonationCategoryResponse>(`/donation-categories/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function removeDonationCategory(token: string, id: string) {
  return apiClient<DonationCategoryResponse>(`/donation-categories/${id}`, {
    token,
    method: 'DELETE',
  });
}
