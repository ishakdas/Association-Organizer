'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { listAssociations, deleteAssociation, type ListParams } from '@/lib/api/associations';
import type { AssociationListResponse } from '@ticketbot/shared-types';

export async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş, lütfen tekrar giriş yapın');
  return token;
}

export const associationsQueryKey = (params: ListParams) =>
  ['associations', params] as const;

export function useAssociations(
  params: ListParams,
  options?: { initialData?: AssociationListResponse },
) {
  return useQuery({
    queryKey: associationsQueryKey(params),
    queryFn: async () => listAssociations(await getAccessToken(), params),
    placeholderData: keepPreviousData,
    initialData: options?.initialData,
  });
}

export function useDeleteAssociation(options?: {
  onSuccess?: (result: { membershipsDeleted: number; telegramAccountsUnlinked: number }) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      deleteAssociation(await getAccessToken(), id),
    onSuccess: (result) => {
      queryClient.clear(); // drop all cached queries so the list page starts fresh
      options?.onSuccess?.(result);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
