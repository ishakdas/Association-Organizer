import type { TicketStatus, TicketPriority } from '../enums';

export interface TicketDto {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  organisationId: string;
  creatorId: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCommentDto {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStatusHistoryDto {
  id: string;
  ticketId: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedAt: string;
}

export interface DeadlineExtensionRequestDto {
  id: string;
  ticketId: string;
  requesterId: string;
  currentDeadline: string;
  requestedDeadline: string;
  reason: string;
  approved: boolean | null;
  resolvedAt: string | null;
  createdAt: string;
}
