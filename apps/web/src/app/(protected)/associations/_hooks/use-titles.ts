'use client';

import { useQuery } from '@tanstack/react-query';
import { listTitles } from '@/lib/api/titles';
import { getAccessToken } from './use-associations';

export function useTitles() {
  return useQuery({
    queryKey: ['titles'],
    queryFn: async () => listTitles(await getAccessToken()),
    staleTime: 5 * 60 * 1000,
  });
}
