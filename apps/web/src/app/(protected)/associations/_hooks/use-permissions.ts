'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getPermissions,
  getUserPermissions,
  grantPermission,
  revokePermission,
  syncPermissions,
  type PermissionAction,
  type UserPermissionSummary,
} from '@/lib/api/permissions';
import { getAccessToken } from './use-associations';

export type { PermissionAction, UserPermissionSummary };

export const permissionsQueryKey = (associationId: string) =>
  ['permissions', associationId] as const;

export const userPermissionsQueryKey = (associationId: string, userId: string) =>
  ['permissions', associationId, userId] as const;

export function usePermissions(associationId: string) {
  return useQuery({
    queryKey: permissionsQueryKey(associationId),
    queryFn: async () => getPermissions(await getAccessToken(), associationId),
  });
}

export function useUserPermissions(associationId: string, userId: string) {
  return useQuery({
    queryKey: userPermissionsQueryKey(associationId, userId),
    queryFn: async () =>
      getUserPermissions(await getAccessToken(), associationId, userId),
    enabled: !!userId,
  });
}

export function useGrantPermission(associationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: PermissionAction }) =>
      grantPermission(await getAccessToken(), associationId, userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', associationId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRevokePermission(associationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: PermissionAction }) =>
      revokePermission(await getAccessToken(), associationId, userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', associationId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useSyncPermissions(associationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, actions }: { userId: string; actions: PermissionAction[] }) =>
      syncPermissions(await getAccessToken(), associationId, userId, actions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', associationId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
