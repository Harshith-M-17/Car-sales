import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/features/auth/RequireAuth';

export const metadata: Metadata = { robots: { index: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={['seller']}>{children}</RequireAuth>;
}
