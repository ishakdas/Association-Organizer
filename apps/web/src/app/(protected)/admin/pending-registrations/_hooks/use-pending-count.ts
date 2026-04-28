'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { listPendingRegistrations } from '@/lib/api/auth';

async function getToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export function usePendingRegistrationsCount(enabled = true) {
  const { data } = useQuery({
    queryKey: ['pending-registrations'],
    queryFn: async () => listPendingRegistrations(await getToken()),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled,
  });
  return data?.length ?? 0;
}
