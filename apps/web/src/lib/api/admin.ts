import { apiClient } from './client';
import type {
  AdminAssociationResponse,
  AdminLinkTokenResponse,
  AdminUserResponse,
  ListAdminAssociationsQuery,
  ListAdminUsersQuery,
  UpdateProfileInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

interface PaginatedAdmin<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function updateProfile(token: string, input: UpdateProfileInput) {
  return apiClient<AuthenticatedUser>('/auth/me', {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAdminUsers(
  token: string,
  query: Partial<ListAdminUsersQuery> = {},
) {
  return apiClient<PaginatedAdmin<AdminUserResponse>>(
    `/admin/users${buildQuery(query)}`,
    { token },
  );
}

export function listSystemAdmins(token: string) {
  return apiClient<AdminUserResponse[]>('/admin/system-admins', { token });
}

export function promoteSystemAdmin(token: string, userId: string) {
  return apiClient<{ promoted: boolean; alreadyAdmin: boolean }>(
    `/admin/system-admins/${userId}`,
    { token, method: 'POST' },
  );
}

export function revokeSystemAdmin(token: string, userId: string) {
  return apiClient<{ revoked: boolean }>(`/admin/system-admins/${userId}`, {
    token,
    method: 'DELETE',
  });
}

export function listAdminAssociations(
  token: string,
  query: Partial<ListAdminAssociationsQuery> = {},
) {
  return apiClient<PaginatedAdmin<AdminAssociationResponse>>(
    `/admin/associations${buildQuery(query)}`,
    { token },
  );
}

export function softDeleteAssociation(token: string, id: string) {
  return apiClient<AdminAssociationResponse>(`/admin/associations/${id}`, {
    token,
    method: 'DELETE',
  });
}

export function restoreAssociation(token: string, id: string) {
  return apiClient<AdminAssociationResponse>(
    `/admin/associations/${id}/restore`,
    { token, method: 'POST' },
  );
}

export function listLinkTokens(token: string) {
  return apiClient<AdminLinkTokenResponse[]>('/admin/telegram-link-tokens', {
    token,
  });
}

export function deleteLinkToken(token: string, id: string) {
  return apiClient<{ deleted: boolean }>(
    `/admin/telegram-link-tokens/${id}`,
    { token, method: 'DELETE' },
  );
}
