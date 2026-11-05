import ListingDetailPage from '@/features/listings/ListingDetailPage';

/**
 * Crawlers and the public get a real 404. The server can't see who's viewing though, and a car
 * that isn't live is still visible to its dealer and to admins, so the page tries again in the
 * browser with their token, and otherwise shows "no longer available".
 */
export default function CarNotFound() {
  return <ListingDetailPage />;
}
