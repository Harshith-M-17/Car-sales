'use client';

import { Heart } from 'lucide-react';
import { useMemo } from 'react';
import { Button, ButtonLink, EmptyState, ErrorNotice, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { ListingCard, ListingGridSkeleton } from '../listings/ListingCard';
import { useFavorites } from './api';

export default function FavoritesPage() {
  const query = useFavorites();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Saved cars" description="Cars you've saved, most recent first" className="mb-6" />
      {query.isError && <ErrorNotice message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
      {!query.isPending && items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" />}
          title="No saved cars yet"
          description="Tap the heart on any car to keep it here for later."
          action={<ButtonLink href="/cars">Browse cars</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {query.isPending ? <ListingGridSkeleton count={4} /> : items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
      {query.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
