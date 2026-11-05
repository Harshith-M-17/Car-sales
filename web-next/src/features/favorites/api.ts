import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CursorPage, ListingCard, ListingDetail } from '@/lib/types';

export const favoriteKeys = { list: ['favorites'] as const };

export function useFavorites() {
  return useInfiniteQuery({
    queryKey: favoriteKeys.list,
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<ListingCard>>('/favorites', { query: { cursor: pageParam, limit: 24 }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

type Pages = InfiniteData<CursorPage<ListingCard>>;

/**
 * Optimistic heart toggle: flips the flag in every cached list/detail immediately,
 * then reconciles with the server (the endpoint is idempotent, so retries are safe).
 */
export function useToggleFavorite() {
  const qc = useQueryClient();

  const patch = (id: string, isFavorited: boolean) => {
    const updateCard = (c: ListingCard) => (c.id === id ? { ...c, isFavorited } : c);
    const updatePages = (data: Pages | undefined) =>
      data && { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(updateCard) })) };

    qc.setQueriesData<Pages>({ queryKey: ['listings', 'search'] }, updatePages);
    qc.setQueriesData<Pages>({ queryKey: ['sellers'] }, (d) => (d && 'pages' in d ? updatePages(d) : d));
    qc.setQueriesData<ListingCard[]>({ queryKey: ['listings', 'similar'] }, (d) => d?.map(updateCard));
    qc.setQueryData<CursorPage<ListingCard>>(['listings', 'latest'], (d) => d && { ...d, items: d.items.map(updateCard) });
    qc.setQueryData<ListingDetail>(['listings', 'detail', id], (d) => d && { ...d, isFavorited });
  };

  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api<void>(`/favorites/${id}`, { method: favorite ? 'PUT' : 'DELETE' }),
    onMutate: ({ id, favorite }) => patch(id, favorite),
    onError: (_err, { id, favorite }) => patch(id, !favorite),
    onSettled: () => qc.invalidateQueries({ queryKey: favoriteKeys.list }),
  });
}
