import { apiClient } from './client';
import type { TicketDto, PaginatedResponse } from '@ticketbot/shared-types';

export async function getTickets(
  token: string,
  organisationId: string,
  params?: { status?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<TicketDto>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  return apiClient<PaginatedResponse<TicketDto>>(
    `/tickets${query ? `?${query}` : ''}`,
    { token, organisationId },
  );
}

export async function getTicket(
  token: string,
  organisationId: string,
  id: string,
): Promise<TicketDto> {
  return apiClient<TicketDto>(`/tickets/${id}`, { token, organisationId });
}
