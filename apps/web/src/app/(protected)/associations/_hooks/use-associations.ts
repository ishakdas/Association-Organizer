'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { listAssociations, type ListParams } from '@/lib/api/associations';
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
