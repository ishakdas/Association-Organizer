'use client';

import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from './use-associations';
import { getAssociationStats } from '@/lib/api/associations';

export const associationStatsQueryKey = (id: string) =>
  ['association-stats', id] as const;

export function useAssociationStats(associationId: string) {
  return useQuery({
    queryKey: associationStatsQueryKey(associationId),
    queryFn: async () => getAssociationStats(await getAccessToken(), associationId),
    staleTime: 60_000,
  });
}
