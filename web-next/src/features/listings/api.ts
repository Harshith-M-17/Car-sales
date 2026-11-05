import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CursorPage, ListingCard, ListingDetail, ListingFacets, SellerPublicProfile } from '@/lib/types';
import { LATEST_LIMIT, listingKeys, SEARCH_PAGE_SIZE, SELLER_PAGE_SIZE, type SearchFilters } from './keys';

export { filtersToParams, type SearchFilters } from './keys';

export function useListingSearch(filters: SearchFilters, limit = SEARCH_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: listingKeys.search(filters),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<ListingCard>>('/listings', {
        query: { ...filters, limit, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keep showing the previous results while a new filter loads (no flash of empty grid).
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useLatestListings(limit = LATEST_LIMIT) {
  return useQuery({
    queryKey: listingKeys.latest,
    queryFn: ({ signal }) => api<CursorPage<ListingCard>>('/listings', { query: { limit }, signal }),
    staleTime: 60_000,
  });
}

/** Site-wide counts per brand, body type, city etc. (cached server-side). */
export function useListingFacets() {
  return useQuery({
    queryKey: listingKeys.facets,
    queryFn: ({ signal }) => api<ListingFacets>('/listings/facets', { signal }),
    staleTime: 5 * 60_000,
  });
}

const fetchListing = (id: string, signal?: AbortSignal) => api<ListingDetail>(`/listings/${id}`, { signal });

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: listingKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchListing(id!, signal),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Warm the detail cache on hover/focus so navigation feels instant. */
export function prefetchListing(queryClient: QueryClient, id: string) {
  return queryClient.prefetchQuery({
    queryKey: listingKeys.detail(id),
    queryFn: ({ signal }) => fetchListing(id, signal),
    staleTime: 30_000,
  });
}

export function useSimilarListings(id: string | undefined) {
  return useQuery({
    queryKey: listingKeys.similar(id ?? ''),
    queryFn: ({ signal }) => api<ListingCard[]>(`/listings/${id}/similar`, { signal }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useSellerProfile(id: string | undefined) {
  return useQuery({
    queryKey: listingKeys.seller(id ?? ''),
    queryFn: ({ signal }) => api<SellerPublicProfile>(`/sellers/${id}`, { signal }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useSellerListings(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: listingKeys.sellerListings(id ?? ''),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<ListingCard>>(`/sellers/${id}/listings`, { query: { cursor: pageParam, limit: SELLER_PAGE_SIZE }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!id,
  });
}
