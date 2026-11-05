const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN');

export const formatPrice = (rupees: number) => inr.format(rupees);

/** Indian-style short price: ₹5.5 Lakh, ₹1.25 Crore. */
export function formatPriceShort(rupees: number): string {
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)} Crore`;
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)} Lakh`;
  return inr.format(rupees);
}

const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');

export const formatKm = (km: number) => `${num.format(km)} km`;
export const formatNumber = (n: number) => num.format(n);

export function ordinalOwner(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} owner`;
}

export const formatAddress = (a: {
  addressLine: string | null;
  locality: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
}) => [a.addressLine, a.locality, a.city, a.state, a.pincode].filter(Boolean).join(', ');

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ACRONYMS = new Set(['suv', 'muv', 'cng', 'lpg', 'abs', 'esp', 'adas', 'tpms', 'led']);

/** `compact-suv` -> `Compact SUV` */
export const labelize = (s: string) =>
  s
    .split(/[-_]/)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : capitalize(w)))
    .join(' ');

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** Fixed to India's time zone so the server and the browser always print the same date. */
export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : '—';

/** wa.me needs digits only, including country code. */
export const whatsappLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
