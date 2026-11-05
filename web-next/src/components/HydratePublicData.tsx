'use client';

import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';

/**
 * Hands data fetched during the server render to the browser's query cache. The server can't
 * see who's viewing, so that data is anonymous (no saved-car hearts). A signed-in viewer's
 * personalised copy must never be overwritten by it, so they fetch their own instead.
 */
export function HydratePublicData({ state, children }: { state: DehydratedState; children: ReactNode }) {
  const { status } = useAuth();
  return <HydrationBoundary state={status === 'authenticated' ? undefined : state}>{children}</HydrationBoundary>;
}
