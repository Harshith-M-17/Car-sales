import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydratePublicData } from '@/components/HydratePublicData';
import { catalogKey, listingKeys } from '@/features/listings/keys';
import ListingDetailPage from '@/features/listings/ListingDetailPage';
import { formatKm, formatPriceShort, labelize, ordinalOwner } from '@/lib/format';
import { getCatalog, getListing, getSimilarListings, isObjectId, seedQueries } from '@/lib/public-data';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const car = isObjectId(id) ? (await getListing(id)).data : null;
  if (!car) return { title: 'Car not found', robots: { index: false } };

  const title = `${car.title} for ${formatPriceShort(car.price)}`;
  const specs = [formatKm(car.kmDriven), labelize(car.fuelType), labelize(car.transmission), ordinalOwner(car.ownerCount)];
  const description = `${title} in ${car.location.city}: ${specs.join(', ')}. Sold by ${car.seller.businessName ?? car.seller.name}.`;
  const cover = car.images[0];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: cover && [{ url: cover.url, width: cover.width, height: cover.height, alt: car.title }],
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const [listing, similar, catalog] = await Promise.all([getListing(id), getSimilarListings(id), getCatalog()]);
  // Sold or hidden, as far as the public can see. See not-found.tsx for its dealer and admins.
  if (listing.notFound) notFound();

  return (
    <HydratePublicData
      state={seedQueries(
        [listingKeys.detail(id), listing.data],
        [listingKeys.similar(id), similar.data],
        [catalogKey, catalog.data],
      )}
    >
      <ListingDetailPage />
    </HydratePublicData>
  );
}
