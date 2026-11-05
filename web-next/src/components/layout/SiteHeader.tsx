'use client';

import {
  CarFront,
  ChevronDown,
  Heart,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import Link from '@/components/Link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Dropdown, type DropdownItem } from '@/components/Dropdown';
import { ButtonLink, cn } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useNewLeadsCount } from '@/features/leads/api';
import type { User } from '@/lib/types';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

function userMenuItems(user: User, newLeads: number): DropdownItem[] {
  const isSeller = user.role === 'seller' || user.role === 'admin';
  return [
    ...(isSeller
      ? [
          { to: '/dashboard', label: 'Dealer dashboard', icon: <LayoutDashboard /> },
          { to: '/dashboard/leads', label: 'Buyer inquiries', icon: <Inbox />, badge: newLeads },
        ]
      : []),
    ...(user.sellerProfile ? [{ to: '/dashboard/branches', label: 'Branches', icon: <MapPin /> }] : []),
    { to: '/favorites', label: 'Saved cars', icon: <Heart /> },
    { to: '/inquiries', label: 'My inquiries', icon: <MessageSquare /> },
    { to: '/account', label: 'Account settings', icon: <UserIcon /> },
    ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin console', icon: <Shield /> }] : []),
  ];
}

function HeaderSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/cars?q=${encodeURIComponent(query)}` : '/cars');
    setQ('');
  };
  return (
    <form onSubmit={submit} role="search" className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search brand, model or variant"
        aria-label="Search cars"
        autoFocus={autoFocus}
        className="h-10 w-full rounded-full border-0 bg-slate-100 pr-4 pl-10 text-sm text-slate-900 ring-1 ring-transparent transition placeholder:text-slate-500 hover:bg-slate-200/70 focus:bg-white focus:ring-2 focus:ring-brand-600 focus:outline-none"
      />
    </form>
  );
}

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'text-brand-700' : 'text-slate-600 hover:text-slate-900',
      )}
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Tied to the page it was opened on, so navigating closes it without an effect.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const isSeller = user?.role === 'seller' || user?.role === 'admin';
  const newLeads = useNewLeadsCount(!!user && isSeller).data?.count ?? 0;

  const signOut = async () => {
    setMenuOpenOn(null);
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="ml-2 hidden items-center md:flex" aria-label="Main">
          <NavItem href="/cars">Buy used cars</NavItem>
          <NavItem href="/sell">For dealers</NavItem>
        </nav>
        {pathname !== '/cars' && <HeaderSearch className="ml-auto hidden w-full max-w-xs lg:block" />}

        <div className={cn('flex items-center gap-2', pathname === '/cars' ? 'ml-auto' : 'ml-auto lg:ml-3')}>
          {status !== 'loading' &&
            (user ? (
              <>
                {isSeller && (
                  <ButtonLink href="/dashboard/listings/new" size="sm" className="hidden h-9 sm:inline-flex">
                    <Plus className="size-4" /> List a car
                  </ButtonLink>
                )}
                <Dropdown
                  className="hidden md:block"
                  label="Account menu"
                  trigger={
                    <span className="relative flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-slate-100">
                      <Avatar name={user.name} />
                      <span className="hidden max-w-36 truncate text-sm font-medium text-slate-800 lg:block">{user.name}</span>
                      <ChevronDown className="size-4 text-slate-400" />
                      {newLeads > 0 && (
                        <span className="absolute top-0.5 left-7 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                      )}
                    </span>
                  }
                  header={
                    <>
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </>
                  }
                  items={[
                    ...userMenuItems(user, newLeads),
                    { label: 'Sign out', icon: <LogOut />, onSelect: signOut, tone: 'danger' },
                  ]}
                />
              </>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <ButtonLink href="/login" variant="ghost" size="sm" className="h-9">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/register" size="sm" className="h-9">
                  Create account
                </ButtonLink>
              </div>
            ))}
          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            {!menuOpen && newLeads > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 pt-4 pb-6 shadow-lift md:hidden">
          <HeaderSearch />
          <nav className="mt-4 grid gap-1" aria-label="Mobile">
            <MobileLink href="/cars" icon={<CarFront />}>Buy used cars</MobileLink>
            <MobileLink href="/sell" icon={<Plus />}>For dealers</MobileLink>
          </nav>
          <div className="mt-4 border-t border-slate-100 pt-4">
            {user ? (
              <>
                <div className="mb-3 flex items-center gap-3 px-2">
                  <Avatar name={user.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="grid gap-1">
                  {userMenuItems(user, newLeads).map((item) => (
                    <MobileLink key={item.to} href={item.to!} icon={item.icon} badge={item.badge}>
                      {item.label}
                    </MobileLink>
                  ))}
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="size-5" /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>
                <ButtonLink href="/register">Create account</ButtonLink>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function MobileLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon?: ReactNode;
  badge?: number;
  children: ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
        active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      <span className="text-slate-400 [&>svg]:size-5">{icon}</span>
      <span className="flex-1">{children}</span>
      {badge ? <span className="rounded-full bg-red-500 px-2 text-xs font-semibold text-white">{badge}</span> : null}
    </Link>
  );
}
