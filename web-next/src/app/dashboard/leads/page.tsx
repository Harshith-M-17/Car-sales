import type { Metadata } from 'next';
import LeadsPage from '@/features/leads/LeadsPage';

export const metadata: Metadata = { title: 'Inquiries' };

export default function Page() {
  return <LeadsPage />;
}
