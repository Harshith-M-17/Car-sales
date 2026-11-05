import Link from '@/components/Link';
import { APP_NAME } from '@/lib/config';
import { Logo } from './Logo';

const FOOTER_LINKS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Buy',
    links: [
      ['All used cars', '/cars'],
      ['SUVs', '/cars?body=suv'],
      ['Automatic cars', '/cars?transmission=automatic'],
      ['Cars under ₹5 Lakh', '/cars?maxPrice=500000'],
      ['First-owner cars', '/cars?maxOwners=1'],
    ],
  },
  {
    title: 'Popular cities',
    links: [
      ['Bengaluru', '/cars?city=bengaluru'],
      ['Mumbai', '/cars?city=mumbai'],
      ['Delhi', '/cars?city=delhi'],
      ['Hyderabad', '/cars?city=hyderabad'],
      ['Pune', '/cars?city=pune'],
    ],
  },
  {
    title: 'For dealers',
    links: [
      ['Why list with us', '/sell'],
      ['Dealer sign up', '/register?as=seller'],
      ['Dealer dashboard', '/dashboard'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="max-w-sm">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed">
            The marketplace for pre-owned cars from local dealers. Find a car, talk to the dealer directly and close the
            deal your way.
          </p>
        </div>
        {FOOTER_LINKS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map(([label, to]) => (
                <li key={to}>
                  <Link href={to} className="transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>
            {APP_NAME} connects buyers with independent dealers. We don&apos;t own, inspect or sell the vehicles listed here.
          </p>
          <p>© {new Date().getFullYear()} {APP_NAME}</p>
        </div>
      </div>
    </footer>
  );
}
