import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, ButtonLink, ErrorNotice, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { APP_NAME } from '@/lib/config';
import { whatsappLink } from '@/lib/format';
import type { ListingDetail, SentLead } from '@/lib/types';
import { useAuth } from '../auth/AuthContext';
import { useCreateLead } from '../leads/api';

const QUICK_MESSAGES = [
  'Is this car still available?',
  'Is the price negotiable?',
  'Can I see the car this weekend?',
];

/**
 * Contact details are revealed only after the buyer sends an inquiry: dealers get a
 * qualified lead and phone numbers aren't scrapeable from listing pages.
 */
export function ContactSeller({ listing }: { listing: ListingDetail }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const createLead = useCreateLead();
  const [message, setMessage] = useState(QUICK_MESSAGES[0]);
  const [lead, setLead] = useState<SentLead | null>(null);

  if (!user) {
    return (
      <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`} size="lg" className="w-full">
        Sign in to contact dealer
      </ButtonLink>
    );
  }

  if (lead) {
    const greeting = `Hi, I'm interested in your ${listing.title} listed on ${APP_NAME}.`;
    return (
      <div className="space-y-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <p className="text-sm text-emerald-900">
          Your inquiry was sent to <strong>{lead.seller.businessName ?? lead.seller.name}</strong>
          {lead.listing.branchName && ` (${lead.listing.branchName})`}. You can also reach them directly:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${lead.seller.phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700">
            <Phone className="size-4" /> Call
          </a>
          <a
            href={whatsappLink(lead.seller.phone, greeting)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white text-sm font-medium text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </div>
        <p className="text-center font-mono text-sm text-emerald-900">{lead.seller.phone}</p>
        {lead.listing.address && (
          <p className="flex gap-1.5 border-t border-emerald-200 pt-3 text-sm text-emerald-900">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            {lead.listing.address}
          </p>
        )}
      </div>
    );
  }

  const submit = () =>
    createLead.mutate({ listingId: listing.id, message: message.trim() || undefined }, { onSuccess: setLead });

  return (
    <div className="space-y-3">
      {createLead.isError && <ErrorNotice message={errorMessage(createLead.error)} />}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMessage(m)}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
          >
            {m}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        maxLength={1000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Message to dealer"
      />
      <Button size="lg" className="w-full" onClick={submit} loading={createLead.isPending}>
        <Phone className="size-4" /> Contact dealer
      </Button>
      <p className="text-center text-xs text-slate-500">Your name and number will be shared with the dealer.</p>
    </div>
  );
}
