import type { Catalog, ListingSort } from '@/lib/types';

// Used by both the server render and the browser, so they agree on every cache key.

export interface SearchFilters {
  q?: string;
  city?: string;
  make?: string;
  model?: string;
  fuel?: string[];
  transmission?: string;
  body?: string[];
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxKm?: number;
  maxOwners?: number;
  sort?: ListingSort;
}

export const LATEST_LIMIT = 8;
export const SEARCH_PAGE_SIZE = 24;
export const SELLER_PAGE_SIZE = 24;

export const catalogKey = ['catalog'] as const;

export const listingKeys = {
  all: ['listings'] as const,
  search: (filters: SearchFilters) => ['listings', 'search', filters] as const,
  latest: ['listings', 'latest'] as const,
  facets: ['listings', 'facets'] as const,
  detail: (id: string) => ['listings', 'detail', id] as const,
  similar: (id: string) => ['listings', 'similar', id] as const,
  seller: (id: string) => ['sellers', id] as const,
  sellerListings: (id: string) => ['sellers', id, 'listings'] as const,
};

const NUMERIC_KEYS = ['minPrice', 'maxPrice', 'minYear', 'maxKm', 'maxOwners'] as const;
const LIST_KEYS = ['fuel', 'body'] as const;
const STRING_KEYS = ['q', 'city', 'make', 'model', 'transmission', 'sort'] as const;

/** The URL is the source of truth for search state (shareable, back-button friendly). */
export function filtersFromParams(params: Pick<URLSearchParams, 'get'>): SearchFilters {
  const f: SearchFilters = {};
  for (const key of STRING_KEYS) {
    const v = params.get(key);
    if (v) (f as Record<string, string>)[key] = v;
  }
  for (const key of NUMERIC_KEYS) {
    const v = Number(params.get(key));
    if (params.get(key) && Number.isFinite(v)) f[key] = v;
  }
  for (const key of LIST_KEYS) {
    const v = params.get(key);
    if (v) f[key] = v.split(',').filter(Boolean).sort();
  }
  return f;
}

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    if (key === 'sort' && value === 'newest') continue;
    params.set(key, Array.isArray(value) ? [...value].sort().join(',') : String(value));
  }
  return params;
}

export function searchHeading(filters: SearchFilters, catalog: Catalog | null | undefined): string {
  const make = catalog?.makes.find((m) => m.slug === filters.make);
  const model = make?.models.find((m) => m.slug === filters.model);
  const what = model ? `Used ${make!.name} ${model.name}` : make ? `Used ${make.name} cars` : 'Used cars';
  if (!filters.city) return what;
  return `${what} in ${catalog?.cities.find((c) => c.slug === filters.city)?.name ?? filters.city}`;
}
