'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSpinner } from './ui';

/** Redirects once rendered in the browser. For decisions that depend on who's signed in. */
export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return <PageSpinner />;
}
