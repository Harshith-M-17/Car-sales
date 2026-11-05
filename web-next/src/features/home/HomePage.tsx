'use client';

import { ArrowRight, BadgeCheck, Camera, Handshake, PhoneCall, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Link from '@/components/Link';
import { useRouter } from 'next/navigation';
import { CarSilhouette } from '@/components/CarSilhouette';
import { Button, ButtonLink } from '@/components/ui';
import { useCatalog } from '@/features/catalog/useCatalog';
import { filtersToParams, useLatestListings, useListingFacets } from '@/features/listings/api';
import { ListingCard, ListingGridSkeleton } from '@/features/listings/ListingCard';
import { APP_NAME } from '@/lib/config';
import { formatNumber, formatPriceShort, labelize } from '@/lib/format';
import type { ListingCard as ListingCardData, ListingFacets } from '@/lib/types';

const BUDGETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹3 Lakh', max: 300_000 },
  { label: '₹3 – 5 Lakh', min: 300_000, max: 500_000 },
  { label: '₹5 – 8 Lakh', min: 500_000, max: 800_000 },
  { label: '₹8 – 12 Lakh', min: 800_000, max: 1_200_000 },
  { label: '₹12 – 20 Lakh', min: 1_200_000, max: 2_000_000 },
  { label: 'Above ₹20 Lakh', min: 2_000_000 },
];
const BODY_TILES = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'convertible'];
const POPULAR_BRANDS = ['maruti-suzuki', 'hyundai', 'tata', 'mahindra', 'honda', 'toyota', 'kia', 'mg'];
const QUICK_SEARCHES: [string, string][] = [
  ['SUVs under ₹10 Lakh', '/cars?body=suv&maxPrice=1000000'],
  ['Automatic', '/cars?transmission=automatic'],
  ['First owner', '/cars?maxOwners=1'],
  ['Electric', '/cars?fuel=electric'],
];
const MAX_PRICES = [300_000, 500_000, 800_000, 1_200_000, 2_000_000, 3_000_000];

export default function HomePage() {
  const latest = useLatestListings(8);
  const items = latest.data?.items ?? [];
  const total = latest.data?.total;
  const facets = useListingFacets().data;
  const bodyCounts = new Map(facets?.bodyTypes.map((b) => [b.value, b.count]));

  return (
    <div>
      <Hero total={total} showcase={items.filter((l) => l.thumbUrl).slice(0, 3)} />
      <TrustStrip />

      <Section title="Browse by body type" action={{ label: 'All cars', to: '/cars' }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BODY_TILES.map((type) => (
            <Link
              key={type}
              href={`/cars?body=${type}`}
              className="group flex flex-col items-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-4 pt-6 pb-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:from-brand-50/60 hover:shadow-lift"
            >
              <CarSilhouette type={type} className="h-12 w-28 text-slate-700 transition-colors group-hover:text-brand-600" />
              <span className="mt-3 text-sm font-semibold text-slate-800">{labelize(type)}</span>
              <span className="mt-0.5 h-4 text-xs text-slate-500">{carCount(bodyCounts.get(type))}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Recently listed" description="Fresh from dealers near you" action={{ label: 'View all', to: '/cars' }}>
        {/* Phones: one swipeable row instead of eight stacked cards. */}
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&>*]:w-[78%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
          {latest.isPending ? (
            <ListingGridSkeleton count={4} />
          ) : (
            items.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 4} />)
          )}
        </div>
      </Section>

      <Section title="Shop by budget">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BUDGETS.map((b) => (
            <Link
              key={b.label}
              href={`/cars?${filtersToParams({ minPrice: b.min, maxPrice: b.max })}`}
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-800 shadow-card transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            >
              {b.label}
            </Link>
          ))}
        </div>
      </Section>

      <PopularBrands facets={facets} />
      <HowItWorks />
      <SellerCta />
    </div>
  );
}

const carCount = (n: number | undefined) => (n ? `${formatNumber(n)} ${n === 1 ? 'car' : 'cars'}` : '');

function Hero({ total, showcase }: { total?: number; showcase: ListingCardData[] }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      {/* Decorative glow + grid */}
      <div className="pointer-events-none absolute -top-40 -left-32 size-[34rem] rounded-full bg-brand-600/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-48 size-[36rem] rounded-full bg-violet-600/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15 backdrop-blur">
            <Sparkles className="size-3.5 text-amber-300" />
            {total !== undefined ? `${formatNumber(total)}${total >= 10_000 ? '+' : ''} cars listed by local dealers` : 'Cars listed by local dealers'}
          </p>
          <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3.5rem]">
            Buy a used car{' '}
            <span className="bg-gradient-to-r from-brand-200 via-white to-violet-200 bg-clip-text text-transparent">
              straight from the dealer
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
            Compare pre-owned cars from trusted dealers in your city. Call the dealer, visit the showroom, inspect the car and
            close the deal on your terms.
          </p>
          <HeroSearch />
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">Popular:</span>
            {QUICK_SEARCHES.map(([label, to]) => (
              <Link key={to} href={to} className="rounded-full bg-white/10 px-3 py-1 text-slate-100 ring-1 ring-white/10 transition hover:bg-white/20">
                {label}
              </Link>
            ))}
          </div>
        </div>

        {showcase.length > 0 && (
          <div className="relative hidden h-[28rem] lg:block" aria-hidden>
            {/* Two recent cars fanned out behind the featured one. */}
            {showcase.slice(1).map((car, i) => (
              <img
                key={car.id}
                src={car.thumbUrl!}
                alt=""
                className={`absolute top-2 aspect-[4/3] w-56 rounded-2xl object-cover opacity-60 shadow-2xl ring-1 ring-white/20 ${
                  i === 0 ? 'left-0 -rotate-6' : 'right-0 rotate-6'
                }`}
              />
            ))}
            <div className="absolute top-10 left-1/2 w-72 -translate-x-1/2 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-white/20">
              <img src={showcase[0].thumbUrl!} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <p className="truncate font-semibold">{showcase[0].title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xl font-bold">{formatPriceShort(showcase[0].price)}</p>
                  <span className="text-xs text-slate-500">{showcase[0].city}</span>
                </div>
              </div>
            </div>
            <div className="absolute top-44 left-0 z-10 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-slate-900 shadow-xl">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <BadgeCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Verified dealers</p>
                <p className="text-xs text-slate-500">Badges on trusted dealers</p>
              </div>
            </div>
            <div className="absolute right-0 bottom-2 z-10 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-slate-900 shadow-xl">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <PhoneCall className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Talk to the dealer</p>
                <p className="text-xs text-slate-500">Call or WhatsApp in one tap</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HeroSearch() {
  const router = useRouter();
  const { data: catalog } = useCatalog();
  const [make, setMake] = useState('');
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/cars?${filtersToParams({ make: make || undefined, city: city || undefined, maxPrice: maxPrice ? Number(maxPrice) : undefined })}`);
  };

  const field = 'h-12 w-full rounded-xl border-0 bg-slate-50 pl-3.5 text-[15px] font-medium text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none';

  return (
    <form onSubmit={submit} className="mt-8 grid gap-2 rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/30 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="sr-only" htmlFor="hero-make">Brand</label>
      <select id="hero-make" value={make} onChange={(e) => setMake(e.target.value)} className={field}>
        <option value="">Any brand</option>
        {catalog?.makes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="hero-city">City</label>
      <select id="hero-city" value={city} onChange={(e) => setCity(e.target.value)} className={field}>
        <option value="">Any city</option>
        {catalog?.cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="hero-budget">Budget</label>
      <select id="hero-budget" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={field}>
        <option value="">Any budget</option>
        {MAX_PRICES.map((b) => <option key={b} value={b}>Under {formatPriceShort(b)}</option>)}
      </select>
      <Button type="submit" size="lg" className="h-12 sm:col-span-3 lg:col-span-1 lg:px-7">
        <Search className="size-4" /> Search cars
      </Button>
    </form>
  );
}

function TrustStrip() {
  const items = [
    { icon: BadgeCheck, title: 'Verified dealers', text: 'Look for the badge on trusted dealers' },
    { icon: PhoneCall, title: 'Direct contact', text: 'Call or WhatsApp dealers instantly' },
    { icon: Handshake, title: 'Deal directly', text: 'Negotiate with the dealer on your terms' },
    { icon: Camera, title: 'Real photos', text: 'Full specs, history and pictures' },
  ];
  return (
    <section className="border-b border-slate-200/80 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {action && (
          <Link href={action.to} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
            {action.label} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function PopularBrands({ facets }: { facets?: ListingFacets }) {
  const makes = useCatalog().data?.makes ?? [];
  const names = new Map(makes.map((m) => [m.slug, m.name]));
  // Brands with the most live cars first; a fixed list until counts arrive.
  const brands = facets?.makes.length
    ? facets.makes.slice(0, 8).map((m) => ({ slug: m.slug, count: m.count }))
    : POPULAR_BRANDS.map((slug) => ({ slug, count: undefined }));
  return (
    <Section title="Popular brands" action={{ label: 'All cars', to: '/cars' }}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {brands.map(({ slug, count }) => (
          <Link
            key={slug}
            href={`/cars?make=${slug}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift sm:px-5"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900 group-hover:text-brand-700">
                {names.get(slug) ?? labelize(slug)}
              </span>
              <span className="mt-0.5 block h-4 text-xs text-slate-500">{carCount(count)}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </Link>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Search, title: 'Search & shortlist', text: 'Filter by budget, brand, fuel and city, then save the cars you like.' },
    { icon: PhoneCall, title: 'Contact the dealer', text: 'Send an inquiry and get the dealer’s number and address instantly — call, WhatsApp or visit.' },
    { icon: ShieldCheck, title: 'Inspect & buy safely', text: 'Visit, test-drive and verify the RC, insurance and service records before you pay.' },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">How {APP_NAME} works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SellerCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 px-6 py-10 text-white sm:px-10 sm:py-12">
        <CarSilhouette type="suv" className="pointer-events-none absolute -right-10 -bottom-6 w-[26rem] text-white/10" />
        <div className="relative max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Are you a dealer? List your cars in minutes.</h2>
          <p className="mt-3 text-brand-100">
            Reach genuine buyers in your city, with every branch on one account. Your number is shared only with people who
            contact you about a car.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/sell" size="lg" variant="light">
              How it works <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/register?as=seller" size="lg" className="bg-white/10 ring-1 ring-white/25 hover:bg-white/20">
              Register as a dealer
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
