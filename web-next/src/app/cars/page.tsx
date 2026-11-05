import type { Metadata } from 'next';
import { HydratePublicData } from '@/components/HydratePublicData';
import { catalogKey, filtersFromParams, listingKeys, searchHeading } from '@/features/listings/keys';
import SearchPage from '@/features/listings/SearchPage';
import { firstPage, getCatalog, searchListings, seedQueries } from '@/lib/public-data';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function readFilters(searchParams: Props['searchParams']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return filtersFromParams(params);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [filters, catalog] = await Promise.all([readFilters(searchParams), getCatalog()]);
  const heading = searchHeading(filters, catalog.data);
  return { title: heading, description: `${heading} from local dealers. Compare prices, then call, WhatsApp or visit the dealer.` };
}

export default async function Page({ searchParams }: Props) {
  const filters = await readFilters(searchParams);
  const [results, catalog] = await Promise.all([searchListings(filters), getCatalog()]);
  return (
    <HydratePublicData
      state={seedQueries([listingKeys.search(filters), firstPage(results.data)], [catalogKey, catalog.data])}
    >
      <SearchPage />
    </HydratePublicData>
  );
}
