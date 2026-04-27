import { apiClient } from './client';
import type {
  CreateEventInput,
  UpdateEventInput,
  EventResponse,
  EventListItem,
  EventAssignmentInput,
  UpdateEventAssignmentInput,
  EventAssignmentResponse,
  CreateEventRoleInput,
  UpdateEventRoleInput,
  EventRoleResponse,
  EventTypeValue,
} from '@ticketbot/shared-validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface EventsListParams {
  type?: EventTypeValue;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface EventsListResponse {
  data: EventListItem[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

function buildEventsQuery(p: EventsListParams): string {
  const sp = new URLSearchParams();
  if (p.type) sp.set('type', p.type);
  if (p.fromDate) sp.set('fromDate', p.fromDate);
  if (p.toDate) sp.set('toDate', p.toDate);
  if (p.page) sp.set('page', String(p.page));
  if (p.pageSize) sp.set('pageSize', String(p.pageSize));
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function listEvents(
  token: string,
  associationId: string,
  params: EventsListParams = {},
) {
  return apiClient<EventsListResponse>(
    `/associations/${associationId}/events${buildEventsQuery(params)}`,
    { token },
  );
}

export function getEvent(token: string, associationId: string, eventId: string) {
  return apiClient<EventResponse>(
    `/associations/${associationId}/events/${eventId}`,
    { token },
  );
}

export function createEvent(
  token: string,
  associationId: string,
  input: CreateEventInput,
) {
  return apiClient<EventResponse>(`/associations/${associationId}/events`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEvent(
  token: string,
  associationId: string,
  eventId: string,
  input: UpdateEventInput,
) {
  return apiClient<EventResponse>(
    `/associations/${associationId}/events/${eventId}`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function deleteEvent(
  token: string,
  associationId: string,
  eventId: string,
) {
  return apiClient<{ ok: true }>(
    `/associations/${associationId}/events/${eventId}`,
    {
      token,
      method: 'DELETE',
    },
  );
}

export function addEventAssignment(
  token: string,
  associationId: string,
  eventId: string,
  input: EventAssignmentInput,
) {
  return apiClient<EventAssignmentResponse>(
    `/associations/${associationId}/events/${eventId}/assignments`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateEventAssignment(
  token: string,
  associationId: string,
  eventId: string,
  assignmentId: string,
  input: UpdateEventAssignmentInput,
) {
  return apiClient<EventAssignmentResponse>(
    `/associations/${associationId}/events/${eventId}/assignments/${assignmentId}`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function removeEventAssignment(
  token: string,
  associationId: string,
  eventId: string,
  assignmentId: string,
) {
  return apiClient<{ ok: true }>(
    `/associations/${associationId}/events/${eventId}/assignments/${assignmentId}`,
    {
      token,
      method: 'DELETE',
    },
  );
}

export function getEventPdfPath(associationId: string, eventId: string): string {
  return `${API_URL}/api/v1/associations/${associationId}/events/${eventId}/pdf`;
}

export async function downloadEventPdf(
  token: string,
  associationId: string,
  eventId: string,
): Promise<Blob> {
  const res = await fetch(getEventPdfPath(associationId, eventId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PDF indirilemedi (${res.status})`);
  return res.blob();
}

// Event roles
export function listEventRoles(token: string, associationId: string) {
  return apiClient<EventRoleResponse[]>(
    `/associations/${associationId}/event-roles`,
    { token },
  );
}

export function createEventRole(
  token: string,
  associationId: string,
  input: CreateEventRoleInput,
) {
  return apiClient<EventRoleResponse>(
    `/associations/${associationId}/event-roles`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateEventRole(
  token: string,
  associationId: string,
  id: string,
  input: UpdateEventRoleInput,
) {
  return apiClient<EventRoleResponse>(
    `/associations/${associationId}/event-roles/${id}`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function deleteEventRole(
  token: string,
  associationId: string,
  id: string,
) {
  return apiClient<{ ok: true }>(
    `/associations/${associationId}/event-roles/${id}`,
    {
      token,
      method: 'DELETE',
    },
  );
}
