import type { EventType, RecurrenceType } from '../enums';

export interface EventRoleDefinitionDto {
  id: string;
  associationId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventAssigneeDto {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface EventAssignmentDto {
  id: string;
  eventId: string;
  membershipId: string;
  member: EventAssigneeDto;
  roleDefinitionId: string | null;
  roleDefinition: { id: string; name: string } | null;
  customRole: string | null;
  notes: string | null;
  notificationSent: boolean;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDto {
  id: string;
  associationId: string;
  title: string;
  description: string | null;
  type: EventType;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notifyAt: string;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndsAt: string | null;
  notificationSent: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignments: EventAssignmentDto[];
}

export interface EventListItemDto {
  id: string;
  associationId: string;
  title: string;
  type: EventType;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notifyAt: string;
  recurrenceType: RecurrenceType;
  notificationSent: boolean;
  assignmentCount: number;
  createdAt: string;
}
