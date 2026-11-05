import { BadgeCheck, Heart, PhoneCall } from 'lucide-react';
import type { ReactNode } from 'react';
import { CarSilhouette } from '@/components/CarSilhouette';
import { APP_NAME } from '@/lib/config';

/** Only allow same-site relative redirects (no open redirect via ?next=). */
export function safeNext(next: string | null): string {
  if (!next) return '/';
  try {
    // Parsed the way the browser will: it treats "/\\evil.com" as "//evil.com" and ignores tabs.
    const url = new URL(next, 'http://this-site.invalid');
    return url.origin === 'http://this-site.invalid' ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
}

const POINTS = [
  { icon: PhoneCall, text: 'Contact dealers directly — call or WhatsApp' },
  { icon: Heart, text: 'Save cars and come back to them anytime' },
  { icon: BadgeCheck, text: 'Dealers list their cars free and get genuine inquiries' },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
      <div className="relative hidden overflow-hidden rounded-3xl bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-violet-600/30 blur-3xl" />
        <p className="relative text-sm font-semibold tracking-wider text-brand-200 uppercase">{APP_NAME}</p>
        <div className="relative">
          <h2 className="max-w-md text-4xl leading-tight font-bold tracking-tight">
            The easiest way to buy a used car from a dealer near you.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-200">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <CarSilhouette type="suv" className="relative -mb-4 w-full max-w-md self-end text-white/10" />
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
