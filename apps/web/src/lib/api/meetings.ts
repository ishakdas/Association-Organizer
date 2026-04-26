import { apiClient } from './client';
import type {
  CreateMeetingNoteInput,
  MeetingNoteResponse,
} from '@ticketbot/shared-validation';

export interface MeetingsListParams {
  page?: number;
  pageSize?: number;
}

export interface MeetingsListResponse {
  data: MeetingNoteResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQuery(params: MeetingsListParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function listMeetings(
  token: string,
  associationId: string,
  params: MeetingsListParams = {},
) {
  return apiClient<MeetingsListResponse>(
    `/associations/${associationId}/meetings${buildQuery(params)}`,
    { token },
  );
}

export function createMeeting(
  token: string,
  associationId: string,
  input: CreateMeetingNoteInput,
) {
  return apiClient<MeetingNoteResponse>(
    `/associations/${associationId}/meetings`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function getMeeting(token: string, meetingId: string) {
  return apiClient<MeetingNoteResponse>(`/meetings/${meetingId}`, { token });
}
