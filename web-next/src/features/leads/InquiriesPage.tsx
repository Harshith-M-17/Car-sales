'use client';

import { Car, MapPin, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import { useMemo } from 'react';
import Link from '@/components/Link';
import { Badge, Button, ButtonLink, EmptyState, ErrorNotice, PageHeader, PageSpinner } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatPriceShort, timeAgo, whatsappLink } from '@/lib/format';
import { useSentLeads } from './api';

/** Buyer's sent inquiries — keeps dealer contact details one tap away. */
export default function InquiriesPage() {
  const query = useSentLeads();
  const leads = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  if (query.isPending) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My inquiries"
        description="Dealers you've contacted. Call or message them again anytime."
        className="mb-6"
      />
      {query.isError && <ErrorNotice message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
      {leads.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="size-7" />}
          title="You haven't contacted any dealers yet"
          action={<ButtonLink href="/cars">Find a car</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:flex-row sm:items-center">
              <Link href={`/cars/${lead.listing.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="h-16 w-22 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {lead.listing.thumbUrl ? (
                    <img src={lead.listing.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <Car className="m-auto mt-4 size-8 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{lead.listing.title}</p>
                  <p className="text-sm text-slate-600">{formatPriceShort(lead.listing.price)}</p>
                  <p className="text-xs text-slate-400">
                    {lead.seller.businessName ?? lead.seller.name} · contacted {timeAgo(lead.lastContactAt)}
                  </p>
                  {lead.listing.address && (
                    <p className="mt-0.5 flex gap-1 text-xs text-slate-500">
                      <MapPin className="mt-px size-3.5 shrink-0" />
                      {lead.listing.address}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-2">
                {lead.status === 'closed' && <Badge>Closed</Badge>}
                <a href={`tel:${lead.seller.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
                  <Phone className="size-4" /> Call
                </a>
                <a
                  href={whatsappLink(lead.seller.phone, `Hi, following up about the ${lead.listing.title}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
