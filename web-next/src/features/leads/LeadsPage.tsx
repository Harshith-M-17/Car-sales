'use client';

import { Car, Inbox, Mail, MessageCircle, Phone } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from '@/components/Link';
import { Button, cn, EmptyState, ErrorNotice, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { formatPriceShort, timeAgo, whatsappLink } from '@/lib/format';
import type { LeadStatus, ReceivedLead } from '@/lib/types';
import { useReceivedLeads, useUpdateLead } from './api';

const FILTERS: { status?: LeadStatus; label: string }[] = [
  { label: 'All' },
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'closed', label: 'Closed' },
];

/** Dealer inbox of buyer inquiries. */
export default function LeadsPage() {
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const query = useReceivedLeads(status);
  const leads = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Buyer inquiries" description="People interested in your cars. Quick replies sell cars faster." />
      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.status)}
            aria-pressed={status === f.status}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition',
              status === f.status ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {query.isError && <ErrorNotice message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
        {query.isPending ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-7" />}
            title="No inquiries yet"
            description="When buyers contact you about a car, they'll appear here with their phone number."
          />
        ) : (
          <ul className="space-y-3">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</ul>
        )}
        {query.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: ReceivedLead }) {
  const update = useUpdateLead();
  const toast = useToast();
  const [note, setNote] = useState(lead.sellerNote ?? '');
  const noteChanged = note !== (lead.sellerNote ?? '');

  const save = (patch: { status?: LeadStatus; sellerNote?: string }) =>
    update.mutate({ id: lead.id, ...patch }, { onError: (err) => toast(errorMessage(err), 'error') });

  return (
    <li
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-card sm:p-5',
        lead.status === 'new' ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200/80',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link href={`/cars/${lead.listing.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-14 w-18 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {lead.listing.thumbUrl ? (
              <img src={lead.listing.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <Car className="m-auto mt-3 size-7 text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{lead.listing.title}</p>
            <p className="text-xs text-slate-500">
              {formatPriceShort(lead.listing.price)}
              {lead.listing.branchName && ` · ${lead.listing.branchName}`}
            </p>
          </div>
        </Link>
        <Select
          value={lead.status}
          onChange={(e) => save({ status: e.target.value as LeadStatus })}
          className="w-36"
          aria-label="Inquiry status"
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </Select>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">
          {lead.buyer.name} <span className="font-normal text-slate-500">· {timeAgo(lead.lastContactAt)}</span>
        </p>
        {lead.message && <p className="mt-1 text-sm text-slate-700">“{lead.message}”</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${lead.buyer.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
            <Phone className="size-4" /> {lead.buyer.phone}
          </a>
          <a
            href={whatsappLink(lead.buyer.phone, `Hi ${lead.buyer.name}, thanks for your interest in the ${lead.listing.title}.`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-slate-300 ring-inset hover:bg-slate-100"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          {lead.buyer.email && (
            <a href={`mailto:${lead.buyer.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-slate-300 ring-inset hover:bg-slate-100">
              <Mail className="size-4" /> Email
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Textarea
          rows={1}
          value={note}
          maxLength={1000}
          placeholder="Private note (e.g. visiting Saturday 11am)"
          onChange={(e) => setNote(e.target.value)}
          className="min-h-10"
          aria-label="Private note"
        />
        {noteChanged && (
          <Button size="sm" className="h-10" onClick={() => save({ sellerNote: note })} loading={update.isPending}>
            Save
          </Button>
        )}
      </div>
    </li>
  );
}
