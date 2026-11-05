import { HydratePublicData } from '@/components/HydratePublicData';
import HomePage from '@/features/home/HomePage';
import { catalogKey, listingKeys } from '@/features/listings/keys';
import { getCatalog, getFacets, getLatestListings, seedQueries } from '@/lib/public-data';

/** Served as a static page and rebuilt in the background, so it stays fast however busy the site is. */
export const revalidate = 15;

export default async function Page() {
  const [latest, facets, catalog] = await Promise.all([getLatestListings(), getFacets(), getCatalog()]);
  return (
    <HydratePublicData
      state={seedQueries(
        [listingKeys.latest, latest.data],
        [listingKeys.facets, facets.data],
        [catalogKey, catalog.data],
      )}
    >
      <HomePage />
    </HydratePublicData>
  );
}
