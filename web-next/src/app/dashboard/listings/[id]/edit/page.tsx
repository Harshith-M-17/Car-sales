import type { Metadata } from 'next';
import ListingFormPage from '@/features/seller/ListingFormPage';

export const metadata: Metadata = { title: 'Edit listing' };

export default function Page() {
  return <ListingFormPage />;
}
