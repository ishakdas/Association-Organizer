import { apiClient } from './client';
import type {
  CreateTaskInput,
  MyTaskItem,
  ResolveDisputeInput,
  TaskActivity,
  TaskResponse,
  TaskStatusValue,
  UpdateTaskInput,
} from '@ticketbot/shared-validation';

export interface TasksListParams {
  status?: TaskStatusValue;
  assignedToUserId?: string;
  page?: number;
  pageSize?: number;
}

export interface TasksListResponse {
  data: TaskResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQuery(params: TasksListParams): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.assignedToUserId)
    sp.set('assignedToUserId', params.assignedToUserId);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function listTasks(
  token: string,
  associationId: string,
  params: TasksListParams = {},
) {
  return apiClient<TasksListResponse>(
    `/associations/${associationId}/tasks${buildQuery(params)}`,
    { token },
  );
}

export function createTask(
  token: string,
  associationId: string,
  input: CreateTaskInput,
) {
  return apiClient<TaskResponse>(`/associations/${associationId}/tasks`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTaskStatus(
  token: string,
  taskId: string,
  status: TaskStatusValue,
) {
  return apiClient<TaskResponse>(`/tasks/${taskId}/status`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateTask(
  token: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  return apiClient<TaskResponse>(`/tasks/${taskId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function resolveTaskDispute(
  token: string,
  taskId: string,
  input: ResolveDisputeInput,
) {
  return apiClient<TaskResponse>(`/tasks/${taskId}/resolve-dispute`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface MyTasksListParams {
  associationId?: string;
  status?: TaskStatusValue;
  page?: number;
  pageSize?: number;
}

export interface MyTasksListResponse {
  data: MyTaskItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function buildMyQuery(params: MyTasksListParams): string {
  const sp = new URLSearchParams();
  if (params.associationId) sp.set('associationId', params.associationId);
  if (params.status) sp.set('status', params.status);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function listMyTasks(token: string, params: MyTasksListParams = {}) {
  return apiClient<MyTasksListResponse>(`/tasks/me${buildMyQuery(params)}`, {
    token,
  });
}

export function listTaskActivities(
  token: string,
  associationId: string,
  taskId: string,
) {
  return apiClient<TaskActivity[]>(
    `/associations/${associationId}/tasks/${taskId}/activities`,
    { token },
  );
}

export interface PrioritizedTask {
  taskId: string;
  priority: 'YUKSEK' | 'ORTA' | 'DUSUK';
  reason: string;
}

export interface PrioritizeTasksResponse {
  prioritizedTasks: PrioritizedTask[];
}

export function prioritizeTasks(
  token: string,
  associationId: string,
) {
  return apiClient<PrioritizeTasksResponse>(
    `/associations/${associationId}/tasks/prioritize`,
    {
      token,
      method: 'POST',
    },
  );
}
