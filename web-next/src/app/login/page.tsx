import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageSpinner } from '@/components/ui';
import LoginPage from '@/features/auth/LoginPage';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <LoginPage />
    </Suspense>
  );
}
