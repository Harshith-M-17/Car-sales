'use client';

import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Navigate } from '@/components/Navigate';
import { EmptyState, PageSpinner, ButtonLink } from '@/components/ui';
import type { Role } from '@/lib/types';
import { useAuth } from './AuthContext';

function ToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [router]);
  return <PageSpinner />;
}

/** Gate for signed-in routes. Admins pass every role check (mirrors the API). */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();

  if (status === 'loading') return <PageSpinner />;
  if (!user) return <ToLogin />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    if (roles.includes('seller')) return <Navigate to="/sell" replace />;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<ShieldAlert className="size-7" />}
          title="You don't have access to this page"
          action={<ButtonLink href="/">Go home</ButtonLink>}
        />
      </div>
    );
  }
  return children;
}
