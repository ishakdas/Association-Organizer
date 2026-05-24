import { apiClient } from './client';

export type PermissionAction =
  | 'USE_MEETING_COMMANDS'
  | 'USE_FINANCE_COMMANDS'
  | 'USE_TASK_COMMANDS'
  | 'VIEW_ALL_MEMBER_TASKS';

export interface UserPermissionSummary {
  userId: string;
  fullName: string;
  email: string | null;
  role: string;
  permissions: PermissionAction[];
}

export function getPermissions(
  token: string,
  associationId: string,
) {
  return apiClient<UserPermissionSummary[]>(
    `/associations/${associationId}/permissions`,
    { token },
  );
}

export function getUserPermissions(
  token: string,
  associationId: string,
  userId: string,
) {
  return apiClient<PermissionAction[]>(
    `/associations/${associationId}/permissions/${userId}`,
    { token },
  );
}

export function grantPermission(
  token: string,
  associationId: string,
  userId: string,
  action: PermissionAction,
) {
  return apiClient<UserPermissionSummary>(
    `/associations/${associationId}/permissions/${userId}`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ action }),
    },
  );
}

export function revokePermission(
  token: string,
  associationId: string,
  userId: string,
  action: PermissionAction,
) {
  return apiClient<void>(
    `/associations/${associationId}/permissions/${userId}/${action}`,
    {
      token,
      method: 'DELETE',
    },
  );
}

export function syncPermissions(
  token: string,
  associationId: string,
  userId: string,
  actions: PermissionAction[],
) {
  return apiClient<{ granted: PermissionAction[]; revoked: PermissionAction[] }>(
    `/associations/${associationId}/permissions/${userId}`,
    {
      token,
      method: 'PUT',
      body: JSON.stringify({ actions }),
    },
  );
}
