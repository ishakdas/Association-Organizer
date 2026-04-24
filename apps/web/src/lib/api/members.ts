import { apiClient } from './client';
import type {
  AddMemberInput,
  MemberResponse,
  MembershipRole,
} from '@ticketbot/shared-validation';

export interface ListMembersParams {
  role?: MembershipRole;
  isActive?: boolean;
}

function buildQuery(params: ListMembersParams): string {
  const sp = new URLSearchParams();
  if (params.role) sp.set('role', params.role);
  if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
  const query = sp.toString();
  return query ? `?${query}` : '';
}

export function listMembers(
  token: string,
  associationId: string,
  params: ListMembersParams = {},
) {
  return apiClient<MemberResponse[]>(
    `/associations/${associationId}/members${buildQuery(params)}`,
    { token },
  );
}

export function addMember(
  token: string,
  associationId: string,
  input: AddMemberInput,
) {
  return apiClient<MemberResponse>(`/associations/${associationId}/members`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function removeMember(
  token: string,
  associationId: string,
  membershipId: string,
) {
  return apiClient<MemberResponse>(
    `/associations/${associationId}/members/${membershipId}`,
    {
      token,
      method: 'DELETE',
    },
  );
}
