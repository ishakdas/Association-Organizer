import { apiClient } from './client';
import type {
  TitleResponse,
  CreateMemberTitleInput,
  UpdateMemberTitleInput,
} from '@ticketbot/shared-validation';

export function listTitles(token: string) {
  return apiClient<TitleResponse[]>('/member-titles', { token });
}

export function listAdminTitles(token: string) {
  return apiClient<TitleResponse[]>('/member-titles?includeInactive=true', {
    token,
  });
}

export function createTitle(token: string, input: CreateMemberTitleInput) {
  return apiClient<TitleResponse>('/member-titles', {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTitle(
  token: string,
  id: string,
  input: UpdateMemberTitleInput,
) {
  return apiClient<TitleResponse>(`/member-titles/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function removeTitle(token: string, id: string) {
  return apiClient<TitleResponse>(`/member-titles/${id}`, {
    token,
    method: 'DELETE',
  });
}
