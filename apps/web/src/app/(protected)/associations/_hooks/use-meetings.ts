'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  analyzeMeeting,
  createMeeting,
  listMeetings,
  updateMeeting,
  summarizeMeeting,
  suggestAgenda,
  type AnalyzeMeetingResponse,
  type MeetingSummaryResponse,
  type AgendaSuggestionResponse,
  type MeetingsListParams,
} from '@/lib/api/meetings';
import type {
  CreateMeetingNoteInput,
  MeetingNoteResponse,
  UpdateMeetingNoteInput,
} from '@ticketbot/shared-validation';
import { getAccessToken } from './use-associations';

export const meetingsQueryKey = (
  associationId: string,
  params: MeetingsListParams,
) => ['meetings', associationId, params] as const;

export function useMeetings(
  associationId: string,
  params: MeetingsListParams = {},
) {
  return useQuery({
    queryKey: meetingsQueryKey(associationId, params),
    queryFn: async () =>
      listMeetings(await getAccessToken(), associationId, params),
  });
}

export function useCreateMeeting(
  associationId: string,
  options?: { onSuccess?: (m: MeetingNoteResponse) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMeetingNoteInput) =>
      createMeeting(await getAccessToken(), associationId, input),
    onSuccess: (m) => {
      toast.success(`"${m.title}" toplantı notu kaydedildi`);
      queryClient.invalidateQueries({ queryKey: ['meetings', associationId] });
      options?.onSuccess?.(m);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMeeting(
  associationId: string,
  options?: { onSuccess?: (m: MeetingNoteResponse) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, input }: { meetingId: string; input: UpdateMeetingNoteInput }) =>
      updateMeeting(await getAccessToken(), associationId, meetingId, input),
    onSuccess: (m) => {
      toast.success(`"${m.title}" güncellendi`);
      queryClient.invalidateQueries({ queryKey: ['meetings', associationId] });
      options?.onSuccess?.(m);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAnalyzeMeeting(
  associationId: string,
  options?: { onSuccess?: (r: AnalyzeMeetingResponse) => void },
) {
  return useMutation({
    mutationFn: async (content: string) =>
      analyzeMeeting(await getAccessToken(), associationId, content),
    onSuccess: (r) => options?.onSuccess?.(r),
    onError: (err: Error) => {
      console.error('[useAnalyzeMeeting] error:', err);
      toast.error(`Analiz başarısız: ${err.message}`);
    },
  });
}

export function useSummarizeMeeting(
  associationId: string,
  options?: { onSuccess?: (r: MeetingSummaryResponse) => void; onError?: (err: Error) => void },
) {
  return useMutation({
    mutationFn: async (content: string) =>
      summarizeMeeting(await getAccessToken(), associationId, content),
    onSuccess: (r) => options?.onSuccess?.(r),
    onError: (err: Error) => {
      toast.error(`Özet başarısız: ${err.message}`);
      options?.onError?.(err);
    },
  });
}

export function useSuggestAgenda(
  associationId: string,
  options?: { onSuccess?: (r: AgendaSuggestionResponse) => void; onError?: (err: Error) => void },
) {
  return useMutation({
    mutationFn: async (content: string) =>
      suggestAgenda(await getAccessToken(), associationId, content),
    onSuccess: (r) => options?.onSuccess?.(r),
    onError: (err: Error) => {
      toast.error(`Gündem önerisi başarısız: ${err.message}`);
      options?.onError?.(err);
    },
  });
}
