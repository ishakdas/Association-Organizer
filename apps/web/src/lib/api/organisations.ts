import { apiClient } from './client';
import type { OrganisationDto, MembershipDto, UserDto, Role } from '@ticketbot/shared-types';
import type {
  CreateOrganisationInput,
  UpdateOrganisationInput,
  AddMemberInput,
} from '@ticketbot/shared-validation';

export interface MembershipWithOrganisation extends MembershipDto {
  organisation: OrganisationDto;
}

export interface MembershipWithUser extends MembershipDto {
  user: Pick<UserDto, 'id' | 'email' | 'name' | 'avatarUrl'>;
}

export interface OrganisationDetail extends OrganisationDto {
  _count: { memberships: number; tickets: number };
}

export function getMyOrganisations(token: string) {
  return apiClient<MembershipWithOrganisation[]>('/organisations', { token });
}

export function createOrganisation(token: string, input: CreateOrganisationInput) {
  return apiClient<OrganisationDto>('/organisations', {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getOrganisation(token: string, organisationId: string) {
  return apiClient<OrganisationDetail>(`/organisations/${organisationId}`, {
    token,
    organisationId,
  });
}

export function updateOrganisation(
  token: string,
  organisationId: string,
  input: UpdateOrganisationInput,
) {
  return apiClient<OrganisationDto>(`/organisations/${organisationId}`, {
    token,
    organisationId,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listMembers(token: string, organisationId: string) {
  return apiClient<MembershipWithUser[]>(`/organisations/${organisationId}/members`, {
    token,
    organisationId,
  });
}

export function addMember(token: string, organisationId: string, input: AddMemberInput) {
  return apiClient<MembershipWithUser>(`/organisations/${organisationId}/members`, {
    token,
    organisationId,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMemberRole(
  token: string,
  organisationId: string,
  userId: string,
  role: Role,
) {
  return apiClient<MembershipDto>(
    `/organisations/${organisationId}/members/${userId}`,
    {
      token,
      organisationId,
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  );
}

export async function removeMember(
  token: string,
  organisationId: string,
  userId: string,
) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(
    `${base}/api/v1/organisations/${organisationId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organisation-id': organisationId,
      },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Silme başarısız' }));
    throw new Error(err.detail ?? `Silme başarısız: ${res.status}`);
  }
}
