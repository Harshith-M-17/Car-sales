'use client';

import { CarFront, CheckCircle2, ExternalLink, Eye, Heart, Inbox, MapPin, MessageSquare, MoreHorizontal, Pause, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from '@/components/Link';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dropdown, type DropdownItem } from '@/components/Dropdown';
import { CarSilhouette } from '@/components/CarSilhouette';
import { StatCard } from '@/components/StatCard';
import { Badge, Button, ButtonLink, cn, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { formatDate, formatNumber, formatPriceShort } from '@/lib/format';
import type { ListingStatus, OwnerListing } from '@/lib/types';
import { useAuth } from '../auth/AuthContext';
import { useNewLeadsCount } from '../leads/api';
import { useListingAction, useMyListings, useSellerStats, type ListingAction } from './api';

const TABS: { status?: ListingStatus; label: string }[] = [
  { label: 'All' },
  { status: 'active', label: 'Live' },
  { status: 'pending', label: 'In review' },
  { status: 'draft', label: 'Drafts' },
  { status: 'inactive', label: 'Paused' },
  { status: 'sold', label: 'Sold' },
  { status: 'expired', label: 'Expired' },
  { status: 'rejected', label: 'Rejected' },
];

const STATUS: Record<ListingStatus, { label: string; tone: 'green' | 'amber' | 'slate' | 'red' | 'blue' }> = {
  active: { label: 'Live', tone: 'green' },
  pending: { label: 'In review', tone: 'amber' },
  draft: { label: 'Draft', tone: 'slate' },
  inactive: { label: 'Paused', tone: 'slate' },
  sold: { label: 'Sold', tone: 'blue' },
  expired: { label: 'Expired', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ListingStatus | undefined>();
  const stats = useSellerStats();
  const newLeads = useNewLeadsCount(true);
  const listings = useMyListings(status);
  const items = useMemo(() => listings.data?.pages.flatMap((p) => p.items) ?? [], [listings.data]);
  const s = stats.data;
  const totalListings = s ? Object.values(s.byStatus).reduce((a, b) => a + (b ?? 0), 0) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Dealer dashboard"
        description={`Welcome back, ${user?.sellerProfile?.businessName ?? user?.name ?? ''}`}
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/dashboard/branches" variant="secondary">
              <MapPin className="size-4" /> Branches
            </ButtonLink>
            <ButtonLink href="/dashboard/listings/new">
              <Plus className="size-4" /> List a car
            </ButtonLink>
          </div>
        }
      />

      {user?.sellerProfile?.branches.length === 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <span>Add your dealership address so buyers can find you. You need one to list more cars.</span>
          <ButtonLink href="/dashboard/branches" size="sm" variant="secondary">
            Add address
          </ButtonLink>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={CarFront} tone="brand" label="Live listings" value={s?.byStatus.active ?? 0} />
        <StatCard icon={Eye} tone="sky" label="Total views" value={s?.totalViews ?? 0} />
        <StatCard icon={MessageSquare} tone="violet" label="Total inquiries" value={s?.totalLeads ?? 0} />
        <Link href="/dashboard/leads" className="rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <StatCard
            icon={Inbox}
            tone="emerald"
            label="New inquiries"
            value={newLeads.data?.count ?? 0}
            highlight={(newLeads.data?.count ?? 0) > 0}
            hint="View inbox →"
          />
        </Link>
      </div>

      <div className="scrollbar-none -mx-4 mt-8 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter by status">
          {TABS.map((tab) => {
            const count = tab.status ? s?.byStatus[tab.status] : totalListings;
            const selected = status === tab.status;
            return (
              <button
                key={tab.label}
                role="tab"
                aria-selected={selected}
                onClick={() => setStatus(tab.status)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
                  selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {tab.label}
                {count ? (
                  <span className={cn('rounded-full px-1.5 text-xs', selected ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600')}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        {listings.isError && <ErrorNotice message={errorMessage(listings.error)} onRetry={() => listings.refetch()} />}
        {listings.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CarFront className="size-7" />}
            title={status ? `No ${STATUS[status].label.toLowerCase()} listings` : 'You have no listings yet'}
            description={status ? undefined : 'List your first car in a few minutes — it’s free.'}
            action={!status && <ButtonLink href="/dashboard/listings/new">List a car</ButtonLink>}
          />
        ) : (
          <ul className="space-y-3">
            {items.map((l) => (
              <ListingRow key={l.id} listing={l} />
            ))}
          </ul>
        )}
        {listings.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={() => listings.fetchNextPage()} loading={listings.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const ACTION_COPY: Record<ListingAction, { label: string; done: string; confirm?: string }> = {
  publish: { label: 'Publish', done: 'Listing published' },
  deactivate: { label: 'Pause', done: 'Listing paused — buyers can no longer see it' },
  'mark-sold': {
    label: 'Mark as sold',
    done: 'Marked as sold — congratulations!',
    confirm: 'The listing will be hidden and buyers will no longer be able to contact you about this car.',
  },
  delete: { label: 'Delete', done: 'Listing deleted', confirm: 'This permanently removes the listing and its photos.' },
};

function ListingRow({ listing }: { listing: OwnerListing }) {
  const action = useListingAction();
  const toast = useToast();
  const [confirming, setConfirming] = useState<ListingAction | null>(null);
  const { status } = listing;

  const run = (a: ListingAction) =>
    action.mutate(
      { id: listing.id, action: a },
      {
        onSuccess: (saved) => {
          toast(saved?.status === 'pending' ? 'Submitted — your listing will go live after review' : ACTION_COPY[a].done);
          setConfirming(null);
        },
        onError: (err) => {
          toast(errorMessage(err), 'error');
          setConfirming(null);
        },
      },
    );
  const request = (a: ListingAction) => (ACTION_COPY[a].confirm ? setConfirming(a) : run(a));

  const primary: ListingAction | null = ['draft', 'inactive', 'expired', 'rejected'].includes(status)
    ? 'publish'
    : ['active', 'pending'].includes(status)
      ? 'deactivate'
      : null;
  const menu: DropdownItem[] = [
    ...(status === 'active' ? [{ label: 'View public page', icon: <ExternalLink />, to: `/cars/${listing.id}` }] : []),
    ...(['active', 'inactive', 'pending', 'expired'].includes(status)
      ? [{ label: 'Mark as sold', icon: <CheckCircle2 />, onSelect: () => request('mark-sold') }]
      : []),
    { label: 'Delete listing', icon: <Trash2 />, tone: 'danger' as const, onSelect: () => request('delete') },
  ];

  return (
    <li className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:gap-4 sm:p-4">
      <Link
        href={status === 'active' ? `/cars/${listing.id}` : `/dashboard/listings/${listing.id}/edit`}
        className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-36"
      >
        {listing.thumbUrl ? (
          <img src={listing.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <CarSilhouette className="w-3/4 text-slate-300" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate font-semibold text-slate-900">{listing.title}</p>
              <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{formatPriceShort(listing.price)}</p>
          </div>
          <Dropdown
            label={`More actions for ${listing.title}`}
            trigger={
              <span className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <MoreHorizontal className="size-5" />
              </span>
            }
            items={menu}
          />
        </div>

        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          {listing.branchName && (
            <span className="flex items-center gap-1" title="Branch"><MapPin className="size-3.5" />{listing.branchName}</span>
          )}
          <span className="flex items-center gap-1" title="Views"><Eye className="size-3.5" />{formatNumber(listing.stats.views)}</span>
          <span className="flex items-center gap-1" title="Inquiries"><MessageSquare className="size-3.5" />{formatNumber(listing.stats.leads)}</span>
          <span className="flex items-center gap-1" title="Saves"><Heart className="size-3.5" />{formatNumber(listing.stats.favorites)}</span>
          {status === 'active' && listing.expiresAt && <span>Expires {formatDate(listing.expiresAt)}</span>}
        </p>
        {listing.rejectionReason && status === 'rejected' && (
          <p className="mt-1.5 text-xs text-red-600">Rejected: {listing.rejectionReason}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {status !== 'sold' && (
            <ButtonLink href={`/dashboard/listings/${listing.id}/edit`} variant="secondary" size="sm">
              <Pencil className="size-3.5" /> Edit
            </ButtonLink>
          )}
          {primary && (
            <Button
              size="sm"
              variant={primary === 'publish' ? 'primary' : 'secondary'}
              loading={action.isPending && action.variables?.action === primary}
              onClick={() => request(primary)}
            >
              {primary === 'publish' ? <Send className="size-3.5" /> : <Pause className="size-3.5" />}
              {ACTION_COPY[primary].label}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `${ACTION_COPY[confirming].label}?` : ''}
        description={confirming ? ACTION_COPY[confirming].confirm : undefined}
        confirmLabel={confirming ? ACTION_COPY[confirming].label : ''}
        tone={confirming === 'delete' ? 'danger' : 'primary'}
        loading={action.isPending}
        onConfirm={() => confirming && run(confirming)}
        onClose={() => setConfirming(null)}
      />
    </li>
  );
}
