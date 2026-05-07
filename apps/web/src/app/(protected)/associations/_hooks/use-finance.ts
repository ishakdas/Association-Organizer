'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getFinanceSummary,
  listTransactions,
  createTransaction,
  deleteTransaction,
  listCategories,
  createCategory,
  deleteCategory,
  recordDonation,
  getSettings,
  updateSettings,
  grantPermission,
  revokePermission,
  listPermissions,
  recordFeePayment,
  getMemberFeeHistory,
  listFeePayments,
} from '@/lib/api/finance';
import type {
  CreateTransactionInput,
  CreateTransactionCategoryInput,
  ListTransactionsQuery,
  AssociationSettingsInput,
  GrantFinancePermissionInput,
} from '@ticketbot/shared-validation';
import { getAccessToken } from './use-associations';

// --- Summary ---

export const financeSummaryKey = (associationId: string) =>
  ['finance', 'summary', associationId] as const;

export function useFinanceSummary(associationId: string) {
  return useQuery({
    queryKey: financeSummaryKey(associationId),
    queryFn: async () => getFinanceSummary(await getAccessToken(), associationId),
  });
}

// --- Transactions ---

export const transactionsKey = (
  associationId: string,
  params: ListTransactionsQuery,
) => ['finance', 'transactions', associationId, params] as const;

export function useTransactions(
  associationId: string,
  params: ListTransactionsQuery,
) {
  return useQuery({
    queryKey: transactionsKey(associationId, params),
    queryFn: async () =>
      listTransactions(await getAccessToken(), associationId, params),
  });
}

export function useCreateTransaction(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) =>
      createTransaction(await getAccessToken(), associationId, input),
    onSuccess: () => {
      toast.success('İşlem kaydedildi');
      queryClient.invalidateQueries({
        queryKey: ['finance', 'transactions', associationId],
      });
      queryClient.invalidateQueries({
        queryKey: financeSummaryKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTransaction(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) =>
      deleteTransaction(await getAccessToken(), associationId, transactionId),
    onSuccess: () => {
      toast.success('İşlem silindi');
      queryClient.invalidateQueries({
        queryKey: ['finance', 'transactions', associationId],
      });
      queryClient.invalidateQueries({
        queryKey: financeSummaryKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Categories ---

export const categoriesKey = (associationId: string) =>
  ['finance', 'categories', associationId] as const;

export function useFinanceCategories(associationId: string) {
  return useQuery({
    queryKey: categoriesKey(associationId),
    queryFn: async () => listCategories(await getAccessToken(), associationId),
  });
}

export function useCreateCategory(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionCategoryInput) =>
      createCategory(await getAccessToken(), associationId, input),
    onSuccess: () => {
      toast.success('Kategori oluşturuldu');
      queryClient.invalidateQueries({
        queryKey: categoriesKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCategory(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) =>
      deleteCategory(await getAccessToken(), associationId, categoryId),
    onSuccess: () => {
      toast.success('Kategori silindi');
      queryClient.invalidateQueries({
        queryKey: categoriesKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Donations ---

export function useRecordDonation(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amountInKurus,
      description,
    }: {
      amountInKurus: number;
      description?: string;
    }) =>
      recordDonation(
        await getAccessToken(),
        associationId,
        amountInKurus,
        description,
      ),
    onSuccess: () => {
      toast.success('Bağış kaydedildi');
      queryClient.invalidateQueries({
        queryKey: ['finance', 'transactions', associationId],
      });
      queryClient.invalidateQueries({
        queryKey: financeSummaryKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Settings ---

export const financeSettingsKey = (associationId: string) =>
  ['finance', 'settings', associationId] as const;

export function useFinanceSettings(associationId: string) {
  return useQuery({
    queryKey: financeSettingsKey(associationId),
    queryFn: async () => getSettings(await getAccessToken(), associationId),
  });
}

export function useUpdateFinanceSettings(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssociationSettingsInput) =>
      updateSettings(await getAccessToken(), associationId, input),
    onSuccess: () => {
      toast.success('Ayarlar güncellendi');
      queryClient.invalidateQueries({
        queryKey: financeSettingsKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Permissions ---

export const permissionsKey = (associationId: string) =>
  ['finance', 'permissions', associationId] as const;

export function useFinancePermissions(associationId: string) {
  return useQuery({
    queryKey: permissionsKey(associationId),
    queryFn: async () => listPermissions(await getAccessToken(), associationId),
  });
}

export function useGrantFinancePermission(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GrantFinancePermissionInput) =>
      grantPermission(await getAccessToken(), associationId, input),
    onSuccess: () => {
      toast.success('Yetki verildi');
      queryClient.invalidateQueries({
        queryKey: permissionsKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeFinancePermission(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      revokePermission(await getAccessToken(), associationId, userId),
    onSuccess: () => {
      toast.success('Yetki alındı');
      queryClient.invalidateQueries({
        queryKey: permissionsKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Fees ---

export const memberFeeHistoryKey = (associationId: string, membershipId: string) =>
  ['finance', 'fees', associationId, membershipId] as const;

export function useMemberFeeHistory(associationId: string, membershipId: string) {
  return useQuery({
    queryKey: memberFeeHistoryKey(associationId, membershipId),
    queryFn: async () => getMemberFeeHistory(await getAccessToken(), associationId, membershipId),
    enabled: !!membershipId,
  });
}

export const feePaymentsKey = (associationId: string) =>
  ['finance', 'fees', associationId] as const;

export function useFeePayments(associationId: string) {
  return useQuery({
    queryKey: feePaymentsKey(associationId),
    queryFn: async () => listFeePayments(await getAccessToken(), associationId),
  });
}

export function useRecordFeePayment(associationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      membershipId: string;
      amountInKurus: number;
      month: string;
      description?: string;
    }) => recordFeePayment(await getAccessToken(), associationId, input),
    onSuccess: () => {
      toast.success('Aidat kaydedildi');
      queryClient.invalidateQueries({
        queryKey: feePaymentsKey(associationId),
      });
      queryClient.invalidateQueries({
        queryKey: financeSummaryKey(associationId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
