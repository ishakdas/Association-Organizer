import { apiClient } from './client';
import type {
  CreateMeetingNoteInput,
  MeetingNoteResponse,
  UpdateMeetingNoteInput,
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

export function updateMeeting(
  token: string,
  associationId: string,
  meetingId: string,
  input: UpdateMeetingNoteInput,
) {
  return apiClient<MeetingNoteResponse>(
    `/associations/${associationId}/meetings/${meetingId}`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export interface AnalyzedActionItem {
  title: string;
  description?: string | null;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  dueDate?: string | null;
}

export interface AnalyzeMeetingResponse {
  actionItems: AnalyzedActionItem[];
  aiAvailable: boolean;
  error?: string;
}

export function analyzeMeeting(
  token: string,
  associationId: string,
  content: string,
) {
  return apiClient<AnalyzeMeetingResponse>(
    `/associations/${associationId}/meetings/analyze`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  );
}
