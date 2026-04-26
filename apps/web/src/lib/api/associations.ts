import { apiClient } from './client';
import type { AssociationDto, AssociationListResponse } from '@ticketbot/shared-types';
import type { CreateAssociationInput } from '@ticketbot/shared-validation';

export interface ListParams {
  search?: string;
  city?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

function buildQuery(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  if (params.city) sp.set('city', params.city);
  if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const query = sp.toString();
  return query ? `?${query}` : '';
}

export function listAssociations(token: string, params: ListParams = {}) {
  return apiClient<AssociationListResponse>(`/associations${buildQuery(params)}`, {
    token,
  });
}

export function getAssociation(token: string, id: string) {
  return apiClient<AssociationDto>(`/associations/${id}`, { token });
}

export function createAssociation(token: string, input: CreateAssociationInput) {
  return apiClient<AssociationDto>('/associations', {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface DeleteAssociationResult {
  associationId: string;
  membershipsDeleted: number;
  telegramAccountsUnlinked: number;
}

export function deleteAssociation(token: string, id: string) {
  return apiClient<DeleteAssociationResult>(`/associations/${id}`, {
    token,
    method: 'DELETE',
  });
}
