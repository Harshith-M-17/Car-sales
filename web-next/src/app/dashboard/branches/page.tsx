import type { Metadata } from 'next';
import BranchesPage from '@/features/seller/BranchesPage';

export const metadata: Metadata = { title: 'Branches' };

export default function Page() {
  return <BranchesPage />;
}
