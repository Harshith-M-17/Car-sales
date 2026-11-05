'use client';

import { CarFront, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, EmptyState, ErrorNotice, Input, Select, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { APP_NAME } from '@/lib/config';
import { formatNumber } from '@/lib/format';
import { useDebouncedValue, useDocumentTitle, useInView } from '@/lib/hooks';
import type { ListingSort } from '@/lib/types';
import { useCatalog } from '../catalog/useCatalog';
import { ActiveFilters } from './ActiveFilters';
import { useListingSearch } from './api';
import { filtersFromParams, filtersToParams, searchHeading, type SearchFilters } from './keys';
import { FiltersPanel } from './FiltersPanel';
import { ListingCard, ListingGridSkeleton } from './ListingCard';

const SORTS: { value: ListingSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'km_asc', label: 'Lowest kilometres' },
  { value: 'year_desc', label: 'Newest model year' },
];

export default function SearchPage() {
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [mobileFilters, setMobileFilters] = useState(false);
  const { data: catalog } = useCatalog();

  const heading = searchHeading(filters, catalog);
  useDocumentTitle(`${heading} · ${APP_NAME}`);

  // Changes the URL without a server round trip; the results come from the query below.
  const setParams = (next: URLSearchParams) => {
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `/cars?${qs}` : '/cars');
  };
  const update = (patch: Partial<SearchFilters>) => setParams(filtersToParams({ ...filters, ...patch }));
  const clearAll = () => {
    setQ('');
    setParams(filtersToParams(filters.sort ? { sort: filters.sort } : {}));
  };

  // Free-text search is debounced so typing doesn't fire a request per keystroke.
  const [q, setQ] = useState(filters.q ?? '');
  // Keep the box in sync when the query changes elsewhere (chip removed, back button).
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if ((filters.q ?? '') !== q.trim()) setQ(filters.q ?? '');
  }
  const debouncedQ = useDebouncedValue(q.trim(), 450);
  useEffect(() => {
    if ((filters.q ?? '') !== debouncedQ) update({ q: debouncedQ || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const query = useListingSearch(filters);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const first = query.data?.pages[0];
  const sentinel = useInView<HTMLDivElement>(
    () => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage(),
    query.hasNextPage,
  );
  const activeCount = Object.keys(filters).filter((k) => k !== 'sort').length;
  const countLabel =
    first?.total !== undefined ? `${formatNumber(first.total)}${first.totalIsCapped ? '+' : ''} cars` : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">{heading}</h1>
          <p className="mt-1 h-5 text-sm text-slate-500" aria-live="polite">
            {countLabel && `${countLabel} available`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search e.g. Creta SX diesel"
              className="pl-10"
              aria-label="Search cars"
            />
          </div>
          <Select
            value={filters.sort ?? 'newest'}
            onChange={(e) => update({ sort: e.target.value as ListingSort })}
            className="min-w-0 flex-1 sm:w-52 sm:flex-none"
            aria-label="Sort by"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" className="h-11 lg:hidden" onClick={() => setMobileFilters(true)}>
            <SlidersHorizontal className="size-4" />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-xs leading-5 text-white">{activeCount}</span>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-5 shadow-card">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white py-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <SlidersHorizontal className="size-4 text-slate-500" /> Filters
              </h2>
              {activeCount > 0 && (
                <button type="button" className="text-sm font-semibold text-brand-700 hover:text-brand-800" onClick={clearAll}>
                  Reset
                </button>
              )}
            </div>
            <FiltersPanel filters={filters} onChange={update} />
          </div>
        </aside>

        <section aria-busy={query.isFetching} className="min-w-0">
          <ActiveFilters filters={filters} onChange={update} onClear={clearAll} />
          <div className={activeCount > 0 ? 'mt-4' : undefined}>
            {query.isError && <ErrorNotice message={errorMessage(query.error)} onRetry={() => query.refetch()} />}

            {!query.isError && !query.isPending && items.length === 0 ? (
              <EmptyState
                icon={<CarFront className="size-7" />}
                title="No cars match these filters"
                description="Try widening your budget, removing a filter or searching another city."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div
                className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${query.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}`}
              >
                {query.isPending ? (
                  <ListingGridSkeleton count={9} />
                ) : (
                  items.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 3} />)
                )}
              </div>
            )}
          </div>

          <div ref={sentinel} className="flex justify-center py-10">
            {query.isFetchingNextPage && <Spinner />}
            {query.hasNextPage && !query.isFetchingNextPage && (
              <Button variant="secondary" onClick={() => query.fetchNextPage()}>
                Show more cars
              </Button>
            )}
            {!query.hasNextPage && items.length > 0 && (
              <p className="text-sm text-slate-400">You&apos;ve seen all {countLabel ?? 'matching cars'}</p>
            )}
          </div>
        </section>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileFilters(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                type="button"
                className="rounded-lg p-1.5 hover:bg-slate-100"
                onClick={() => setMobileFilters(false)}
                aria-label="Close filters"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <FiltersPanel filters={filters} onChange={update} />
            </div>
            <div className="flex gap-3 border-t border-slate-200 p-4">
              <Button variant="secondary" className="flex-1" onClick={clearAll}>
                Reset
              </Button>
              <Button className="flex-[2]" onClick={() => setMobileFilters(false)}>
                Show {countLabel ?? 'cars'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
