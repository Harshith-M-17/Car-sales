import 'server-only';
import { dehydrate, QueryClient, type DehydratedState, type QueryKey } from '@tanstack/react-query';
import { cache } from 'react';
import { LATEST_LIMIT, SEARCH_PAGE_SIZE, SELLER_PAGE_SIZE, type SearchFilters } from '@/features/listings/keys';
import type { Catalog, CursorPage, ListingCard, ListingDetail, ListingFacets, SellerPublicProfile } from './types';
import { toQueryString, type QueryValue } from './query-string';

const API_BASE = `${(process.env.API_ORIGIN ?? 'http://localhost:4000').replace(/\/+$/, '')}/api/v1`;
const TIMEOUT_MS = 5_000;
// Renders for every visitor come from this one server, so they shouldn't share one IP's rate limit.
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

interface PublicResult<T> {
  data: T | null;
  notFound: boolean;
}

/**
 * Anonymous read for rendering a public page. Never throws: if the API is down, slow or rate
 * limiting this server, the page still renders and the browser fetches the data itself.
 */
async function publicGet<T>(
  path: string,
  { query, revalidate }: { query?: Record<string, QueryValue>; revalidate?: number } = {},
): Promise<PublicResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}${toQueryString(query)}`, {
      ...(revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate } }),
      ...(INTERNAL_KEY && { headers: { 'x-internal-key': INTERNAL_KEY } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { data: (await res.json()) as T, notFound: false };
    return { data: null, notFound: res.status === 404 };
  } catch {
    return { data: null, notFound: false };
  }
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;
export const isObjectId = (id: string) => OBJECT_ID.test(id);

// Wrapped in cache() so generateMetadata and the page share one request per render.

// Next's fetch cache is only for what can't go away. It keeps its old copy when a refresh gets
// anything but a 200, so a car that was sold (now a 404) could stay on the site. The rest are
// uncached here: the API already caches them, and clears that as soon as a dealer changes something.
export const getCatalog = cache(() => publicGet<Catalog>('/catalog', { revalidate: 3600 }));
export const getLatestListings = cache(() =>
  publicGet<CursorPage<ListingCard>>('/listings', { query: { limit: LATEST_LIMIT }, revalidate: 15 }),
);
export const getFacets = cache(() => publicGet<ListingFacets>('/listings/facets', { revalidate: 60 }));

export const getListing = cache((id: string) => publicGet<ListingDetail>(`/listings/${id}`));
export const getSimilarListings = cache((id: string) => publicGet<ListingCard[]>(`/listings/${id}/similar`));
export const getSeller = cache((id: string) => publicGet<SellerPublicProfile>(`/sellers/${id}`));
export const getSellerListings = cache((id: string) =>
  publicGet<CursorPage<ListingCard>>(`/sellers/${id}/listings`, { query: { limit: SELLER_PAGE_SIZE } }),
);

export const searchListings = (filters: SearchFilters) =>
  publicGet<CursorPage<ListingCard>>('/listings', { query: { ...filters, limit: SEARCH_PAGE_SIZE } });

/** Cached data in the shape useInfiniteQuery expects for its first page. */
export const firstPage = <T,>(page: T | null) => page && { pages: [page], pageParams: [undefined] };

/** Builds what HydratePublicData needs. Anything the API didn't return is left for the browser. */
export function seedQueries(...entries: [QueryKey, unknown][]): DehydratedState {
  const client = new QueryClient();
  for (const [key, data] of entries) {
    if (data !== null && data !== undefined) client.setQueryData(key, data);
  }
  return dehydrate(client);
}
