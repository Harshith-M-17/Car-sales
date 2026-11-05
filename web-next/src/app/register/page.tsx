import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageSpinner } from '@/components/ui';
import RegisterPage from '@/features/auth/RegisterPage';

export const metadata: Metadata = { title: 'Create account' };

export default function Page() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <RegisterPage />
    </Suspense>
  );
}
