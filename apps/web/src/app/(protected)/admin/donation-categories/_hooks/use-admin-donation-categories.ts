'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createDonationCategory,
  listAdminDonationCategories,
  removeDonationCategory,
  updateDonationCategory,
} from '@/lib/api/donation-categories';
import type {
  CreateDonationCategoryInput,
  DonationCategoryResponse,
  UpdateDonationCategoryInput,
} from '@ticketbot/shared-validation';
import { getAccessToken } from '../../../associations/_hooks/use-associations';

export const adminDonationCategoriesQueryKey = [
  'admin',
  'donation-categories',
] as const;

export function useAdminDonationCategories(options?: {
  initialData?: DonationCategoryResponse[];
}) {
  return useQuery({
    queryKey: adminDonationCategoriesQueryKey,
    queryFn: async () => listAdminDonationCategories(await getAccessToken()),
    initialData: options?.initialData,
  });
}

export function useCreateDonationCategory(options?: {
  onSuccess?: (category: DonationCategoryResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDonationCategoryInput) =>
      createDonationCategory(await getAccessToken(), input),
    onSuccess: (category) => {
      toast.success(`"${category.name}" bağış türü eklendi`);
      queryClient.invalidateQueries({
        queryKey: adminDonationCategoriesQueryKey,
      });
      queryClient.invalidateQueries({ queryKey: ['donation-categories'] });
      options?.onSuccess?.(category);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDonationCategory(options?: {
  onSuccess?: (category: DonationCategoryResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: UpdateDonationCategoryInput;
    }) => updateDonationCategory(await getAccessToken(), args.id, args.input),
    onSuccess: (category) => {
      queryClient.invalidateQueries({
        queryKey: adminDonationCategoriesQueryKey,
      });
      queryClient.invalidateQueries({ queryKey: ['donation-categories'] });
      options?.onSuccess?.(category);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveDonationCategory(options?: {
  onSuccess?: (category: DonationCategoryResponse) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      removeDonationCategory(await getAccessToken(), id),
    onSuccess: (category) => {
      toast.success(`"${category.name}" arşivlendi`);
      queryClient.invalidateQueries({
        queryKey: adminDonationCategoriesQueryKey,
      });
      queryClient.invalidateQueries({ queryKey: ['donation-categories'] });
      options?.onSuccess?.(category);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
