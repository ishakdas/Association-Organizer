'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createAssociation } from '@/lib/api/associations';
import type { CreateAssociationInput } from '@ticketbot/shared-validation';
import { getAccessToken } from './use-associations';

export function useCreateAssociation(options?: {
  onSuccess?: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssociationInput) =>
      createAssociation(await getAccessToken(), input),
    onSuccess: (association) => {
      toast.success(`"${association.name}" kaydedildi`);
      queryClient.invalidateQueries({ queryKey: ['associations'] });
      options?.onSuccess?.(association.id);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
