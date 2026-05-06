'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createTask,
  listTaskActivities,
  listTasks,
  updateTaskStatus,
  prioritizeTasks,
  type TasksListParams,
} from '@/lib/api/tasks';
import type {
  CreateTaskInput,
  TaskResponse,
  TaskStatusValue,
} from '@ticketbot/shared-validation';
import type { PrioritizeTasksResponse } from '@/lib/api/tasks';
import { getAccessToken } from './use-associations';

export const tasksQueryKey = (
  associationId: string,
  params: TasksListParams,
) => ['tasks', associationId, params] as const;

export function useTasks(
  associationId: string,
  params: TasksListParams = {},
) {
  return useQuery({
    queryKey: tasksQueryKey(associationId, params),
    queryFn: async () =>
      listTasks(await getAccessToken(), associationId, params),
  });
}

export function useCreateTask(
  associationId: string,
  options?: { onSuccess?: (task: TaskResponse) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) =>
      createTask(await getAccessToken(), associationId, input),
    onSuccess: (task) => {
      toast.success(`"${task.title}" görevi eklendi`);
      queryClient.invalidateQueries({ queryKey: ['tasks', associationId] });
      options?.onSuccess?.(task);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTaskStatus(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatusValue }) =>
      updateTaskStatus(await getAccessToken(), input.taskId, input.status),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', associationId] });
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(associationId, vars.taskId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export const taskActivitiesQueryKey = (associationId: string, taskId: string) =>
  ['task-activities', associationId, taskId] as const;

export function useTaskActivities(
  associationId: string,
  taskId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: taskActivitiesQueryKey(associationId, taskId),
    queryFn: async () =>
      listTaskActivities(await getAccessToken(), associationId, taskId),
    enabled,
  });
}

export function usePrioritizeTasks(
  associationId: string,
  options?: { onSuccess?: (r: PrioritizeTasksResponse) => void; onError?: (err: Error) => void },
) {
  return useMutation({
    mutationFn: async () =>
      prioritizeTasks(await getAccessToken(), associationId),
    onSuccess: (r) => options?.onSuccess?.(r),
    onError: (err: Error) => {
      toast.error(`Önceliklendirme başarısız: ${err.message}`);
      options?.onError?.(err);
    },
  });
}
