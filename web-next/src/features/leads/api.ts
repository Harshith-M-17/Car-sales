import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CursorPage, LeadStatus, ReceivedLead, SentLead } from '@/lib/types';

export const leadKeys = {
  sent: ['leads', 'sent'] as const,
  received: (status?: LeadStatus) => ['leads', 'received', status ?? 'all'] as const,
  newCount: ['leads', 'new-count'] as const,
};

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingId: string; message?: string }) =>
      api<SentLead>('/leads', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.sent }),
  });
}

export function useSentLeads() {
  return useInfiniteQuery({
    queryKey: leadKeys.sent,
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<SentLead>>('/leads/sent', { query: { cursor: pageParam, limit: 20 }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useReceivedLeads(status?: LeadStatus) {
  return useInfiniteQuery({
    queryKey: leadKeys.received(status),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<ReceivedLead>>('/leads/received', { query: { cursor: pageParam, limit: 20, status }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useNewLeadsCount(enabled: boolean) {
  return useQuery({
    queryKey: leadKeys.newCount,
    queryFn: ({ signal }) => api<{ count: number }>('/leads/received/new-count', { signal }),
    enabled,
    refetchInterval: 60_000, // cheap indexed count; keeps the header badge fresh
    refetchIntervalInBackground: false,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: LeadStatus; sellerNote?: string }) =>
      api<ReceivedLead>(`/leads/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
