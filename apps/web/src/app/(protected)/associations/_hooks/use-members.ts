'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listMembers,
  addMember,
  removeMember,
  type ListMembersParams,
} from '@/lib/api/members';
import type { AddMemberInput, MemberResponse } from '@ticketbot/shared-validation';
import { getAccessToken } from './use-associations';

export const membersQueryKey = (associationId: string, params: ListMembersParams) =>
  ['members', associationId, params] as const;

export function useMembers(
  associationId: string,
  params: ListMembersParams = {},
  options?: { initialData?: MemberResponse[] },
) {
  return useQuery({
    queryKey: membersQueryKey(associationId, params),
    queryFn: async () => listMembers(await getAccessToken(), associationId, params),
    initialData: options?.initialData,
  });
}

export function useAddMember(
  associationId: string,
  options?: { onSuccess?: (member: MemberResponse) => void },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMemberInput) =>
      addMember(await getAccessToken(), associationId, input),
    onSuccess: (member) => {
      toast.success(`${member.user.fullName} eklendi`);
      queryClient.invalidateQueries({ queryKey: ['members', associationId] });
      options?.onSuccess?.(member);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRemoveMember(associationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (membershipId: string) =>
      removeMember(await getAccessToken(), associationId, membershipId),
    onSuccess: (member) => {
      toast.success(`${member.user.fullName} dernekten çıkarıldı`);
      queryClient.invalidateQueries({ queryKey: ['members', associationId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
