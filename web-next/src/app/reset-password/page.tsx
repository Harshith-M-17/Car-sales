import type { Metadata } from 'next';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default function Page() {
  return <ResetPasswordPage />;
}
