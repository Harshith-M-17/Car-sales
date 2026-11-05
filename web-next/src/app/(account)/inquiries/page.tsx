import type { Metadata } from 'next';
import InquiriesPage from '@/features/leads/InquiriesPage';

export const metadata: Metadata = { title: 'My inquiries' };

export default function Page() {
  return <InquiriesPage />;
}
