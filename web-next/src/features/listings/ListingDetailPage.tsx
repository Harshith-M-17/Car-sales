'use client';

import {
  BadgeCheck,
  Calendar,
  CarFront,
  Check,
  ChevronRight,
  Fuel,
  Gauge,
  MapPin,
  Settings2,
  Share2,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import Link from '@/components/Link';
import { useParams } from 'next/navigation';
import { Badge, ButtonLink, Card, EmptyState, ErrorNotice, PageSpinner } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { APP_NAME } from '@/lib/config';
import {
  formatAddress,
  formatDate,
  formatKm,
  formatNumber,
  formatPrice,
  formatPriceShort,
  labelize,
  ordinalOwner,
  timeAgo,
} from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import type { ListingDetail } from '@/lib/types';
import { useAuth } from '../auth/AuthContext';
import { useCatalogLookups } from '../catalog/useCatalog';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { useListing, useSimilarListings } from './api';
import { ContactSeller } from './ContactSeller';
import { Gallery } from './Gallery';
import { ListingCard } from './ListingCard';

const CONTACT_ANCHOR = 'contact-seller';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, status } = useAuth();
  const { data: listing, isPending, error, refetch } = useListing(id);
  const similar = useSimilarListings(listing?.status === 'active' ? id : undefined);
  useDocumentTitle(listing ? `${listing.title} for ${formatPriceShort(listing.price)} · ${APP_NAME}` : undefined);

  // Count a view only when the page is actually shown (fetching/prefetching never counts), and
  // only once we know who's viewing: a server-rendered car is on screen before the session is back.
  const countable = status !== 'loading' && listing?.status === 'active' && listing.sellerId !== user?.id;
  useEffect(() => {
    if (countable && id) void api(`/listings/${id}/views`, { method: 'POST' }).catch(() => undefined);
  }, [id, countable]);

  if (isPending) return <PageSpinner />;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        {error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <EmptyState
            icon={<CarFront className="size-7" />}
            title="This car is no longer available"
            description="It may have been sold or removed by the dealer."
            action={<ButtonLink href="/cars">Browse other cars</ButtonLink>}
          />
        ) : (
          <ErrorNotice message={errorMessage(error)} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  const isOwner = user?.id === listing.sellerId;
  const canContact = !isOwner && listing.status === 'active';

  return (
    <div className={canContact ? 'pb-24 lg:pb-0' : undefined}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs listing={listing} />

        {isOwner && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
            <span>
              This is your listing · <strong className="capitalize">{listing.status === 'inactive' ? 'paused' : listing.status}</strong>
              {listing.rejectionReason && <> · Rejected: {listing.rejectionReason}</>}
            </span>
            <ButtonLink href={`/dashboard/listings/${listing.id}/edit`} size="sm" variant="secondary">
              Edit listing
            </ButtonLink>
          </div>
        )}

        {/* Mobile order: gallery → summary/contact → details. Desktop: summary is a sticky right column. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
          <div className="min-w-0">
            <Gallery images={listing.images} title={listing.title} bodyType={listing.bodyType} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <SummaryCard listing={listing} isOwner={isOwner} canContact={canContact} />
            <SellerCard listing={listing} />
            <SafetyTips />
          </aside>

          <div className="min-w-0 space-y-6 lg:col-start-1">
            <Specs listing={listing} />
            <Features listing={listing} />
            {listing.description && (
              <Card>
                <h2 className="mb-3 text-lg font-semibold">About this car</h2>
                <p className="text-[15px] leading-relaxed whitespace-pre-line text-slate-700">{listing.description}</p>
              </Card>
            )}
          </div>
        </div>

        {similar.data && similar.data.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-bold tracking-tight">Similar cars you may like</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {similar.data.slice(0, 8).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </div>

      {canContact && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.25)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg leading-tight font-bold">{formatPriceShort(listing.price)}</p>
              <p className="truncate text-xs text-slate-500">{listing.title}</p>
            </div>
            <a
              href={`#${CONTACT_ANCHOR}`}
              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Contact dealer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({ listing }: { listing: ListingDetail }) {
  const crumbs: [string, string][] = [
    ['Used cars', '/cars'],
    [listing.make, `/cars?make=${listing.makeSlug}`],
    [listing.model, `/cars?make=${listing.makeSlug}&model=${listing.modelSlug}`],
  ];
  return (
    <nav className="mb-5 flex items-center gap-1 overflow-hidden text-sm whitespace-nowrap text-slate-500" aria-label="Breadcrumb">
      {crumbs.map(([label, to], i) => (
        <span key={to} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 text-slate-300" />}
          <Link href={to} className="hover:text-slate-800">
            {label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function SummaryCard({ listing, isOwner, canContact }: { listing: ListingDetail; isOwner: boolean; canContact: boolean }) {
  const toast = useToast();
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Card>
      <div id={CONTACT_ANCHOR} className="scroll-mt-24" />
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl leading-snug font-bold tracking-tight text-slate-900">{listing.title}</h1>
        <div className="flex shrink-0 gap-1">
          {!isOwner && <FavoriteButton listingId={listing.id} isFavorited={listing.isFavorited} variant="icon" />}
          <button
            type="button"
            onClick={share}
            aria-label="Share"
            className="flex size-9 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-sm text-slate-500">
        <MapPin className="size-4" />
        {[listing.location.locality, listing.location.city].filter(Boolean).join(', ')}
      </p>

      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3.5">
        <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{formatPrice(listing.price)}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {formatPriceShort(listing.price)} ·{' '}
          {listing.negotiable ? <span className="font-medium text-emerald-700">Negotiable</span> : 'Fixed price'}
        </p>
      </div>

      <div className="mt-5">
        {isOwner ? null : canContact ? (
          <ContactSeller listing={listing} />
        ) : (
          <Badge tone="slate" className="px-3 py-1 text-sm">
            {listing.status === 'sold' ? 'This car has been sold' : 'No longer available'}
          </Badge>
        )}
      </div>

      {/* "2 hours ago" can legitimately differ between the server render and the browser. */}
      <p suppressHydrationWarning className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
        Listed {timeAgo(listing.publishedAt ?? listing.createdAt)} · {formatNumber(listing.views)}{' '}
        {listing.views === 1 ? 'view' : 'views'}
      </p>
    </Card>
  );
}

function SellerCard({ listing }: { listing: ListingDetail }) {
  const s = listing.seller;
  const { branchName, addressLine } = listing.location;
  return (
    <Card className="p-5 sm:p-5">
      <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Sold by</p>
      <Link href={`/dealers/${listing.sellerId}`} className="group flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Store className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold text-slate-900 group-hover:text-brand-700">
            <span className="truncate">{s.businessName ?? s.name}</span>
            {s.verified && <BadgeCheck className="size-4 shrink-0 text-brand-600" aria-label="Verified dealer" />}
          </span>
          <span className="block text-sm text-slate-500">
            Dealer
            {!addressLine && s.city && ` · ${s.city}`}
          </span>
        </span>
        <ChevronRight className="size-5 text-slate-300 group-hover:text-brand-600" />
      </Link>
      {addressLine && (
        <div className="mt-4 flex gap-2.5 border-t border-slate-100 pt-4 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <p>
            <span className="font-medium text-slate-900">Car is at {branchName}</span>
            <span className="mt-0.5 block text-slate-600">{formatAddress(listing.location)}</span>
          </p>
        </div>
      )}
    </Card>
  );
}

function SafetyTips() {
  return (
    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <ShieldCheck className="size-4" /> Buy safely
      </p>
      <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-amber-900/80">
        <li>Inspect and test-drive the car in person.</li>
        <li>Verify the RC, insurance, PUC and service records.</li>
        <li>Never pay an advance before seeing the car.</li>
      </ul>
      <p className="mt-3 text-xs text-amber-900/60">
        {APP_NAME} connects buyers and independent dealers and does not inspect listed cars.
      </p>
    </div>
  );
}

function SpecTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card ring-1 ring-slate-200/70 [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Specs({ listing }: { listing: ListingDetail }) {
  const { states } = useCatalogLookups();
  const more: [string, string][] = [
    ...(listing.variant ? ([['Variant', listing.variant]] as [string, string][]) : []),
    ...(listing.color ? ([['Colour', listing.color]] as [string, string][]) : []),
    ...(listing.registrationState
      ? ([['Registered in', states.get(listing.registrationState) ?? listing.registrationState]] as [string, string][])
      : []),
    ...(listing.insuranceValidTill ? ([['Insurance valid till', formatDate(listing.insuranceValidTill)]] as [string, string][]) : []),
    ['Listed on', formatDate(listing.publishedAt ?? listing.createdAt)],
  ];

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Car overview</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SpecTile icon={<Calendar />} label="Model year" value={String(listing.year)} />
        <SpecTile icon={<Gauge />} label="Kilometres" value={formatKm(listing.kmDriven)} />
        <SpecTile icon={<Fuel />} label="Fuel" value={labelize(listing.fuelType)} />
        <SpecTile icon={<Settings2 />} label="Transmission" value={labelize(listing.transmission)} />
        <SpecTile icon={<Users />} label="Ownership" value={ordinalOwner(listing.ownerCount)} />
        <SpecTile icon={<CarFront />} label="Body type" value={listing.bodyType ? labelize(listing.bodyType) : '—'} />
      </div>
      <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {more.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Features({ listing }: { listing: ListingDetail }) {
  const { features } = useCatalogLookups();
  if (listing.features.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Features</h2>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {listing.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-3.5" />
            </span>
            {features.get(f) ?? labelize(f)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
