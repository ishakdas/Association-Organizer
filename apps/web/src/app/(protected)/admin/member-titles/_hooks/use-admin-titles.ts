'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createTitle,
  listAdminTitles,
  removeTitle,
  updateTitle,
} from '@/lib/api/titles';
import type {
  CreateMemberTitleInput,
  TitleResponse,
  UpdateMemberTitleInput,
} from '@ticketbot/shared-validation';
import { getAccessToken } from '../../../associations/_hooks/use-associations';

export const adminTitlesQueryKey = ['admin', 'titles'] as const;

export function useAdminTitles(options?: { initialData?: TitleResponse[] }) {
  return useQuery({
    queryKey: adminTitlesQueryKey,
    queryFn: async () => listAdminTitles(await getAccessToken()),
    initialData: options?.initialData,
  });
}

export function useCreateTitle(options?: {
  onSuccess?: (title: TitleResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMemberTitleInput) =>
      createTitle(await getAccessToken(), input),
    onSuccess: (title) => {
      toast.success(`"${title.name}" unvanı eklendi`);
      queryClient.invalidateQueries({ queryKey: adminTitlesQueryKey });
      // The public list is also consumed by the member-add dialog; refresh it.
      queryClient.invalidateQueries({ queryKey: ['titles'] });
      options?.onSuccess?.(title);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTitle(options?: {
  onSuccess?: (title: TitleResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateMemberTitleInput }) =>
      updateTitle(await getAccessToken(), args.id, args.input),
    onSuccess: (title) => {
      queryClient.invalidateQueries({ queryKey: adminTitlesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['titles'] });
      options?.onSuccess?.(title);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveTitle(options?: {
  onSuccess?: (title: TitleResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => removeTitle(await getAccessToken(), id),
    onSuccess: (title) => {
      toast.success(`"${title.name}" arşivlendi`);
      queryClient.invalidateQueries({ queryKey: adminTitlesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['titles'] });
      options?.onSuccess?.(title);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
