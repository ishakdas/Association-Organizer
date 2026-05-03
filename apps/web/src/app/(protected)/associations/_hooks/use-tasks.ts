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
  resolveTaskDispute,
  updateTask,
  updateTaskStatus,
  type TasksListParams,
} from '@/lib/api/tasks';
import type {
  CreateTaskInput,
  ResolveDisputeInput,
  TaskResponse,
  TaskStatusValue,
  UpdateTaskInput,
} from '@ticketbot/shared-validation';
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
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(associationId, vars.taskId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTask(
  associationId: string,
  options?: { onSuccess?: (task: TaskResponse) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; input: UpdateTaskInput }) =>
      updateTask(await getAccessToken(), input.taskId, input.input),
    onSuccess: (task) => {
      toast.success(`"${task.title}" güncellendi`);
      queryClient.invalidateQueries({ queryKey: ['tasks', associationId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(associationId, task.id),
      });
      options?.onSuccess?.(task);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResolveTaskDispute(
  associationId: string,
  options?: { onSuccess?: (task: TaskResponse) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; input: ResolveDisputeInput }) =>
      resolveTaskDispute(await getAccessToken(), input.taskId, input.input),
    onSuccess: (task) => {
      toast.success('İtiraz çözüldü, görev yeniden atandı');
      queryClient.invalidateQueries({ queryKey: ['tasks', associationId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(associationId, task.id),
      });
      options?.onSuccess?.(task);
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
