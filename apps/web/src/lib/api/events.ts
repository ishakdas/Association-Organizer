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
  IslamicEventSuggestionOutput,
  ExternalEventItem,
  SuggestIslamicEventsInput,
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

// Islamic event suggestions
export function suggestIslamicEvents(
  token: string,
  associationId: string,
  input: SuggestIslamicEventsInput,
) {
  return apiClient<IslamicEventSuggestionOutput>(
    `/associations/${associationId}/events/suggest-islamic`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function generateSchedule(
  token: string,
  body: {
    title: string;
    description: string;
    islamicSession: { title: string; description: string; duration: string };
    timeRange: { start: string; end: string };
  },
) {
  return apiClient<{ items: Array<{ time: string; title: string; description?: string; duration: string }> }>(
    `/ai/generate-schedule`,
    { token, method: 'POST', body: JSON.stringify(body) },
  );
}

export function generateSocialContent(
  token: string,
  body: {
    title: string;
    description: string;
    targetAudience: string;
    category: string;
    keyTopics: string[];
    eventDate: string;
    location: string;
    startTime: string;
    endTime: string;
  },
) {
  return apiClient<{ instagramCaption: string; hashtags: string[]; storyText: string; posterTagline: string }>(
    `/ai/generate-social`,
    { token, method: 'POST', body: JSON.stringify(body) },
  );
}

export function generateRecurringProgram(
  token: string,
  associationId: string,
  suggestionId: string,
  weeks: number,
) {
  return apiClient<{ programTitle: string; totalWeeks: number; description: string; sessions: Array<{ weekNumber: number; title: string; description: string; theme: string; keyTopics: string[] }> }>(
    `/associations/${associationId}/events/suggestions/${suggestionId}/recurring`,
    { token, method: 'POST', body: JSON.stringify({ weeks }) },
  );
}

export function saveSuggestion(
  token: string,
  suggestionId: string,
  note?: string,
) {
  return apiClient<{ id: string }>(
    `/associations/_/events/suggestions/${suggestionId}/save`,
    { token, method: 'POST', body: JSON.stringify({ note }) },
  );
}

export function unsaveSuggestion(token: string, suggestionId: string) {
  return apiClient<{ ok: true }>(
    `/associations/_/events/suggestions/${suggestionId}/save`,
    { token, method: 'DELETE' },
  );
}

export function listSavedSuggestions(token: string) {
  return apiClient<Array<{ id: string; note: string | null; createdAt: string; suggestion: { id: string; title: string; description: string; category: string; targetAudience: string; createdAt: string } }>>(
    `/associations/_/events/saved-suggestions`,
    { token },
  );
}

export function addFeedback(
  token: string,
  suggestionId: string,
  rating: number,
  isHelpful?: boolean,
  comment?: string,
) {
  return apiClient<{ id: string }>(
    `/associations/_/events/suggestions/${suggestionId}/feedback`,
    { token, method: 'POST', body: JSON.stringify({ rating, isHelpful, comment }) },
  );
}

export function addProgramToEvent(
  token: string,
  associationId: string,
  eventId: string,
  items: Array<{ startTime: string; duration: string; title: string; description?: string; order?: number }>,
) {
  return apiClient<Array<{ id: string; startTime: string; duration: string; title: string; description: string | null; order: number }>>(
    `/associations/${associationId}/events/${eventId}/program`,
    { token, method: 'POST', body: JSON.stringify({ items }) },
  );
}

export function getEventProgram(token: string, associationId: string, eventId: string) {
  return apiClient<Array<{ id: string; startTime: string; duration: string; title: string; description: string | null; order: number }>>(
    `/associations/${associationId}/events/${eventId}/program`,
    { token },
  );
}

export function getIslamicCalendarUpcoming(token: string, associationId: string) {
  return apiClient<{
    currentHijriDate: string;
    currentHijriMonthName: string;
    currentHijriYear: number;
    upcomingHolidays: Array<{ name: string; nameEn: string; hijriDate: string; gregorianDate: string; daysUntil: number; category: string }>;
  }>(`/associations/${associationId}/islamic-calendar/upcoming`, { token });
}

// Gebze municipality external events
export function listGebzeExternalEvents(
  token: string,
  associationId: string,
) {
  return apiClient<{ data: ExternalEventItem[] }>(
    `/associations/${associationId}/events/external-events/gebze`,
    { token },
  );
}
