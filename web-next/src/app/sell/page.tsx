import type { Metadata } from 'next';
import SellPage from '@/features/seller/SellPage';

export const metadata: Metadata = {
  title: 'For dealers',
  description: 'List your used cars for free and reach genuine buyers in your city, with every branch on one account.',
};

export default function Page() {
  return <SellPage />;
}
