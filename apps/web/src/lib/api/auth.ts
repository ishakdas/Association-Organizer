import { apiClient } from './client';

export interface BranchEmailStatus {
  status: 'unknown' | 'pending' | 'rejected' | 'active' | 'no_password';
}

export interface PendingRegistration {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  city: string;
  district: string;
  message: string | null;
  status: string;
  createdAt: string;
}

export function checkBranchEmail(email: string) {
  return apiClient<BranchEmailStatus>('/auth/check-branch-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function requestBranchRegistration(data: {
  email: string;
  fullName: string;
  phone?: string;
  city: string;
  district: string;
  message?: string;
}) {
  return apiClient<void>('/auth/request-branch-registration', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listPendingRegistrations(token: string) {
  return apiClient<PendingRegistration[]>('/auth/pending-registrations', { token });
}

export function listApprovedRegistrations(token: string) {
  return apiClient<PendingRegistration[]>('/auth/approved-registrations', { token });
}

export function resendInvite(token: string, id: string) {
  return apiClient<{ sent: boolean }>(
    `/auth/pending-registrations/${id}/resend`,
    { token, method: 'POST' },
  );
}

export function approveBranchRegistration(token: string, id: string) {
  return apiClient<{}>(`/auth/pending-registrations/${id}/approve`, {
    token,
    method: 'POST',
  });
}

export function rejectBranchRegistration(token: string, id: string) {
  return apiClient<void>(`/auth/pending-registrations/${id}/reject`, {
    token,
    method: 'POST',
  });
}

export function clearTempPasswordFlag(token: string) {
  return apiClient<void>('/auth/clear-temp-password-flag', {
    token,
    method: 'POST',
  });
}

export function resendInviteForUser(token: string, userId: string) {
  return apiClient<{ sent: boolean }>('/auth/resend-invite-for-user', {
    token,
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}
