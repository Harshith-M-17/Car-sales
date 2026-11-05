import type { Metadata } from 'next';
import DashboardPage from '@/features/seller/DashboardPage';

export const metadata: Metadata = { title: 'Dealer dashboard' };

export default function Page() {
  return <DashboardPage />;
}
