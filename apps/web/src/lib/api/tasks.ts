import { apiClient } from './client';
import type {
  CreateTaskInput,
  MyTaskItem,
  ResolveDisputeInput,
  TaskActivity,
  TaskResponse,
  TaskStatusValue,
  TaskPriorityValue,
  UpdateTaskInput,
} from '@ticketbot/shared-validation';
import type { PaginatedResponse } from '@ticketbot/shared-types';
import { buildQuery } from './query';

export interface TasksListParams {
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  assignedToUserId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type TasksListResponse = PaginatedResponse<TaskResponse>;

export function listTasks(token: string, associationId: string, params: TasksListParams = {}) {
  return apiClient<TasksListResponse>(
    `/associations/${associationId}/tasks${buildQuery({ ...params })}`,
    { token },
  );
}

export function getTask(token: string, associationId: string, taskId: string) {
  return apiClient<TaskResponse>(`/associations/${associationId}/tasks/${taskId}`, { token });
}

export function createTask(token: string, associationId: string, input: CreateTaskInput) {
  return apiClient<TaskResponse>(`/associations/${associationId}/tasks`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTaskStatus(token: string, taskId: string, status: TaskStatusValue) {
  return apiClient<TaskResponse>(`/tasks/${taskId}/status`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateTask(token: string, taskId: string, input: UpdateTaskInput) {
  return apiClient<TaskResponse>(`/tasks/${taskId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(token: string, associationId: string, taskId: string) {
  return apiClient<TaskResponse>(`/associations/${associationId}/tasks/${taskId}`, {
    token,
    method: 'DELETE',
  });
}

export function resolveTaskDispute(token: string, taskId: string, input: ResolveDisputeInput) {
  return apiClient<TaskResponse>(`/tasks/${taskId}/resolve-dispute`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface MyTasksListParams {
  associationId?: string;
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  search?: string;
  sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type MyTasksListResponse = PaginatedResponse<MyTaskItem>;

export function listMyTasks(token: string, params: MyTasksListParams = {}) {
  return apiClient<MyTasksListResponse>(`/tasks/me${buildQuery({ ...params })}`, {
    token,
  });
}

export function listTaskActivities(token: string, associationId: string, taskId: string) {
  return apiClient<TaskActivity[]>(`/associations/${associationId}/tasks/${taskId}/activities`, {
    token,
  });
}

export interface PrioritizedTask {
  taskId: string;
  priority: 'YUKSEK' | 'ORTA' | 'DUSUK';
  reason: string;
}

export interface PrioritizeTasksResponse {
  prioritizedTasks: PrioritizedTask[];
}

export function prioritizeTasks(token: string, associationId: string) {
  return apiClient<PrioritizeTasksResponse>(`/associations/${associationId}/tasks/prioritize`, {
    token,
    method: 'POST',
  });
}

export interface ExtractTasksFromMeetingInput {
  meetingNoteId: string;
}

export interface ExtractTasksFromMeetingResponse {
  extractedTasks: TaskResponse[];
  count: number;
}

export function extractTasksFromMeeting(
  token: string,
  associationId: string,
  input: ExtractTasksFromMeetingInput,
) {
  return apiClient<ExtractTasksFromMeetingResponse>(
    `/associations/${associationId}/tasks/extract-from-meeting`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
