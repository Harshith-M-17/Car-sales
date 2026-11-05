'use client';

import { BadgeCheck, CarFront, MapPin, Store } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Button, ButtonLink, EmptyState, PageSpinner } from '@/components/ui';
import { formatAddress, formatDate } from '@/lib/format';
import { useSellerListings, useSellerProfile } from './api';
import { ListingCard, ListingGridSkeleton } from './ListingCard';

export default function SellerPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useSellerProfile(id);
  const listings = useSellerListings(id);
  const items = useMemo(() => listings.data?.pages.flatMap((p) => p.items) ?? [], [listings.data]);
  const seller = profile.data;

  if (profile.isPending) return <PageSpinner />;
  if (!seller) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Dealer not found" action={<ButtonLink href="/cars">Browse cars</ButtonLink>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Store className="size-8" />
        </div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {seller.businessName ?? seller.name}
            {seller.verified && <BadgeCheck className="size-6 text-brand-600" aria-label="Verified dealer" />}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <Badge tone="blue">Dealer</Badge>
            {seller.city && <span className="flex items-center gap-1"><MapPin className="size-4" />{seller.city}</span>}
            <span>Member since {formatDate(seller.memberSince)}</span>
          </p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-3xl font-bold">{seller.activeListings}</p>
          <p className="text-sm text-slate-500">cars for sale</p>
        </div>
      </div>

      {seller.branches.length > 0 && (
        <>
          <h2 className="mt-10 mb-5 text-xl font-bold tracking-tight">{seller.branches.length > 1 ? 'Branches' : 'Address'}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seller.branches.map((branch) => (
              <li key={branch.id} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{branch.name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{formatAddress(branch)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 mb-5 text-xl font-bold tracking-tight">Cars from this dealer</h2>
      {!listings.isPending && items.length === 0 ? (
        <EmptyState icon={<CarFront className="size-7" />} title="No cars listed right now" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.isPending ? <ListingGridSkeleton count={4} /> : items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
      {listings.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={() => listings.fetchNextPage()} loading={listings.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
