'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listMyTasks,
  updateTaskStatus,
  type MyTasksListParams,
} from '@/lib/api/tasks';
import type { TaskStatusValue } from '@ticketbot/shared-validation';
import { getAccessToken } from '@/app/(protected)/associations/_hooks/use-associations';

export const myTasksQueryKey = (params: MyTasksListParams) =>
  ['my-tasks', params] as const;

export function useMyTasks(params: MyTasksListParams = {}) {
  return useQuery({
    queryKey: myTasksQueryKey(params),
    queryFn: async () => listMyTasks(await getAccessToken(), params),
  });
}

export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatusValue }) =>
      updateTaskStatus(await getAccessToken(), input.taskId, input.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
