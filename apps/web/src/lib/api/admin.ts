import { apiClient } from './client';
import type {
  AdminAssociationResponse,
  AdminLinkTokenResponse,
  AdminUserResponse,
  ListAdminAssociationsQuery,
  ListAdminUsersQuery,
  UpdateProfileInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser, PaginatedResponse } from '@ticketbot/shared-types';
import { buildQuery } from './query';

export function updateProfile(token: string, input: UpdateProfileInput) {
  return apiClient<AuthenticatedUser>('/auth/me', {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAdminUsers(token: string, query: Partial<ListAdminUsersQuery> = {}) {
  return apiClient<PaginatedResponse<AdminUserResponse>>(`/admin/users${buildQuery(query)}`, {
    token,
  });
}

export function listSystemAdmins(token: string) {
  return apiClient<AdminUserResponse[]>('/admin/system-admins', { token });
}

export function promoteSystemAdmin(token: string, userId: string) {
  return apiClient<{ promoted: boolean; alreadyAdmin: boolean }>(`/admin/system-admins/${userId}`, {
    token,
    method: 'POST',
  });
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
  return apiClient<PaginatedResponse<AdminAssociationResponse>>(
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
  return apiClient<AdminAssociationResponse>(`/admin/associations/${id}/restore`, {
    token,
    method: 'POST',
  });
}

export function hardDeleteAssociation(token: string, id: string) {
  return apiClient<{
    associationId: string;
    usersDeleted: number;
    membershipsDeleted: number;
  }>(`/admin/associations/${id}/hard`, { token, method: 'DELETE' });
}

export function listLinkTokens(token: string) {
  return apiClient<AdminLinkTokenResponse[]>('/admin/telegram-link-tokens', {
    token,
  });
}

export function deleteLinkToken(token: string, id: string) {
  return apiClient<{ deleted: boolean }>(`/admin/telegram-link-tokens/${id}`, {
    token,
    method: 'DELETE',
  });
}
