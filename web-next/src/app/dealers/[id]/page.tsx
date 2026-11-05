import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydratePublicData } from '@/components/HydratePublicData';
import { listingKeys } from '@/features/listings/keys';
import SellerPage from '@/features/listings/SellerPage';
import { firstPage, getSeller, getSellerListings, isObjectId, seedQueries } from '@/lib/public-data';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const dealer = isObjectId(id) ? (await getSeller(id)).data : null;
  if (!dealer) return { title: 'Dealer not found', robots: { index: false } };

  const name = dealer.businessName ?? dealer.name;
  const where = dealer.city ? ` in ${dealer.city}` : '';
  return {
    title: name,
    description: `${name} is a used-car dealer${where} with ${dealer.activeListings} ${dealer.activeListings === 1 ? 'car' : 'cars'} for sale.`,
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const [profile, listings] = await Promise.all([getSeller(id), getSellerListings(id)]);
  if (profile.notFound) notFound();

  return (
    <HydratePublicData
      state={seedQueries([listingKeys.seller(id), profile.data], [listingKeys.sellerListings(id), firstPage(listings.data)])}
    >
      <SellerPage />
    </HydratePublicData>
  );
}
