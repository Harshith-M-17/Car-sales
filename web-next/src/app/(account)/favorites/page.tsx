import type { Metadata } from 'next';
import FavoritesPage from '@/features/favorites/FavoritesPage';

export const metadata: Metadata = { title: 'Saved cars' };

export default function Page() {
  return <FavoritesPage />;
}
