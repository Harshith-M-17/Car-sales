import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api';
import type { Catalog } from '@/lib/types';
import { catalogKey } from '../listings/keys';

/** Static reference data — fetched once per session (and HTTP-cached by the browser via ETag). */
export function useCatalog() {
  return useQuery({
    queryKey: catalogKey,
    queryFn: ({ signal }) => api<Catalog>('/catalog', { signal }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Lookup helpers derived once from the catalog. */
export function useCatalogLookups() {
  const { data } = useCatalog();
  return useMemo(() => {
    const makes = new Map(data?.makes.map((m) => [m.slug, m]) ?? []);
    const features = new Map(data?.features.map((f) => [f.slug, f.label]) ?? []);
    const cities = new Map(data?.cities.map((c) => [c.slug, c.name]) ?? []);
    const states = new Map(data?.registrationStates.map((s) => [s.code, s.name]) ?? []);
    return { catalog: data, makes, features, cities, states };
  }, [data]);
}
