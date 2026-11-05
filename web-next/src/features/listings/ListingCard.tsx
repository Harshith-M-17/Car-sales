import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MapPin } from 'lucide-react';
import { memo, useRef } from 'react';
import Link from '@/components/Link';
import { CarSilhouette } from '@/components/CarSilhouette';
import { Badge } from '@/components/ui';
import { formatPriceShort, labelize } from '@/lib/format';
import type { ListingCard as ListingCardData } from '@/lib/types';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { prefetchListing } from './api';

const shortKm = (km: number) => (km >= 1000 ? `${Math.round(km / 1000)}k km` : `${km} km`);
const ownerShort = (n: number) => (n === 1 ? '1st owner' : n === 2 ? '2nd owner' : `${n}${n === 3 ? 'rd' : 'th'} owner`);

/** Memoised: grids re-render on every page fetch, cards only when their own data changes. */
export const ListingCard = memo(function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData;
  priority?: boolean;
}) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Hover intent: prefetch only when the pointer rests on a card, not while scrolling past.
  const prefetchSoon = () => {
    timer.current = setTimeout(() => void prefetchListing(qc, listing.id), 150);
  };
  const cancelPrefetch = () => clearTimeout(timer.current);
  const unavailable = listing.status !== 'active';

  return (
    <Link
      href={`/cars/${listing.id}`}
      onMouseEnter={prefetchSoon}
      onMouseLeave={cancelPrefetch}
      onFocus={() => void prefetchListing(qc, listing.id)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {listing.thumbUrl ? (
          <img
            src={listing.thumbUrl}
            alt={listing.title}
            width={480}
            height={360}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            className={`size-full object-cover transition duration-500 group-hover:scale-[1.03] ${unavailable ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <CarSilhouette className="w-3/5 text-slate-300" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <FavoriteButton listingId={listing.id} isFavorited={listing.isFavorited} />
        </div>
        <div className="absolute top-3 left-3 flex gap-1.5">
          {unavailable ? (
            <Badge tone="dark">{listing.status === 'sold' ? 'Sold' : 'No longer available'}</Badge>
          ) : (
            listing.seller.verified && (
              <Badge tone="dark">
                <BadgeCheck className="size-3.5 text-emerald-300" />
                Verified dealer
              </Badge>
            )
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-slate-900 group-hover:text-brand-700">
          {listing.title}
        </h3>
        <ul className="mt-2.5 flex gap-1.5 text-xs text-slate-600">
          {[shortKm(listing.kmDriven), labelize(listing.fuelType), labelize(listing.transmission)].map((spec) => (
            <li key={spec} className="rounded-md bg-slate-100 px-2 py-1 font-medium whitespace-nowrap">
              {spec}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{formatPriceShort(listing.price)}</p>
          {listing.negotiable && <span className="pb-0.5 text-xs font-medium text-emerald-700">Negotiable</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{[listing.locality, listing.city].filter(Boolean).join(', ')}</span>
          </span>
          <span className="shrink-0">{ownerShort(listing.ownerCount)}</span>
        </div>
      </div>
    </Link>
  );
});

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <div className="aspect-[4/3] animate-pulse bg-slate-200" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-5 w-14 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
            <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </>
  );
}
