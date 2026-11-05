import { Types } from 'mongoose';
import { Listing } from './schemas/listing.schema';

/**
 * Projections are part of the performance contract: list endpoints load only what a
 * card renders (no description, images array or features), keeping documents small
 * on the wire and in the driver.
 */
export const LISTING_CARD_PROJECTION = {
  title: 1,
  make: 1,
  model: 1,
  variant: 1,
  year: 1,
  kmDriven: 1,
  fuelType: 1,
  transmission: 1,
  ownerCount: 1,
  price: 1,
  negotiable: 1,
  'location.city': 1,
  'location.locality': 1,
  coverThumbUrl: 1,
  'sellerSnapshot.verified': 1,
  'sellerSnapshot.businessName': 1,
  status: 1,
  publishedAt: 1,
  createdAt: 1,
} as const;

export const OWNER_LISTING_PROJECTION = {
  ...LISTING_CARD_PROJECTION,
  'location.branchName': 1,
  stats: 1,
  expiresAt: 1,
  rejectionReason: 1,
  updatedAt: 1,
} as const;

export const LISTING_DETAIL_PROJECTION = {
  seller: 1,
  sellerSnapshot: 1,
  branch: 1,
  title: 1,
  make: 1,
  makeSlug: 1,
  model: 1,
  modelSlug: 1,
  variant: 1,
  year: 1,
  kmDriven: 1,
  fuelType: 1,
  transmission: 1,
  bodyType: 1,
  ownerCount: 1,
  color: 1,
  price: 1,
  negotiable: 1,
  registrationState: 1,
  insuranceValidTill: 1,
  description: 1,
  features: 1,
  location: 1,
  images: 1,
  status: 1,
  publishedAt: 1,
  expiresAt: 1,
  soldAt: 1,
  rejectionReason: 1,
  'stats.views': 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

type Lean<K extends keyof Listing> = Pick<Listing, K> & { _id: Types.ObjectId };

export type ListingCardLean = Lean<
  | 'title'
  | 'make'
  | 'model'
  | 'variant'
  | 'year'
  | 'kmDriven'
  | 'fuelType'
  | 'transmission'
  | 'ownerCount'
  | 'price'
  | 'negotiable'
  | 'coverThumbUrl'
  | 'status'
  | 'publishedAt'
  | 'createdAt'
> & {
  location: Pick<Listing['location'], 'city' | 'locality'>;
  sellerSnapshot: Pick<Listing['sellerSnapshot'], 'verified' | 'businessName'>;
};

export type OwnerListingLean = Omit<ListingCardLean, 'location'> &
  Pick<Listing, 'stats' | 'expiresAt' | 'rejectionReason' | 'updatedAt'> & {
    location: Pick<Listing['location'], 'city' | 'locality' | 'branchName'>;
  };

export type ListingDetailLean = Lean<keyof typeof LISTING_DETAIL_PROJECTION & keyof Listing> & {
  stats?: Partial<Listing['stats']>;
};

export interface ListingCardView {
  id: string;
  title: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  kmDriven: number;
  fuelType: string;
  transmission: string;
  ownerCount: number;
  price: number;
  negotiable: boolean;
  city: string;
  locality: string | null;
  thumbUrl: string | null;
  seller: { verified: boolean; businessName: string | null };
  status: string;
  publishedAt: Date | null;
  isFavorited?: boolean;
}

export interface OwnerListingView extends ListingCardView {
  branchName: string | null;
  stats: { views: number; leads: number; favorites: number };
  expiresAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingDetailView {
  id: string;
  sellerId: string;
  seller: {
    name: string;
    businessName: string | null;
    city: string | null;
    verified: boolean;
  };
  branchId: string | null;
  title: string;
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  variant: string | null;
  year: number;
  kmDriven: number;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  ownerCount: number;
  color: string | null;
  price: number;
  negotiable: boolean;
  registrationState: string | null;
  insuranceValidTill: Date | null;
  description: string | null;
  features: string[];
  location: {
    branchName: string | null;
    addressLine: string | null;
    city: string;
    state: string | null;
    locality: string | null;
    pincode: string | null;
    lat: number | null;
    lng: number | null;
  };
  images: { id: string; url: string; thumbUrl: string; width: number; height: number }[];
  status: string;
  rejectionReason: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  soldAt: Date | null;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  isFavorited?: boolean;
}

/** One line for buyers, e.g. on an inquiry they sent. */
export function formatAddress(loc: Listing['location']): string {
  return [loc.addressLine, loc.locality, loc.city, loc.state, loc.pincode]
    .filter(Boolean)
    .join(', ');
}

export function toListingCard(doc: ListingCardLean): ListingCardView {
  return {
    id: doc._id.toString(),
    title: doc.title,
    make: doc.make,
    model: doc.model,
    variant: doc.variant ?? null,
    year: doc.year,
    kmDriven: doc.kmDriven,
    fuelType: doc.fuelType,
    transmission: doc.transmission,
    ownerCount: doc.ownerCount,
    price: doc.price,
    negotiable: doc.negotiable,
    city: doc.location.city,
    locality: doc.location.locality ?? null,
    thumbUrl: doc.coverThumbUrl ?? null,
    seller: {
      verified: doc.sellerSnapshot.verified,
      businessName: doc.sellerSnapshot.businessName ?? null,
    },
    status: doc.status,
    publishedAt: doc.publishedAt ?? null,
  };
}

export function toOwnerListing(doc: OwnerListingLean): OwnerListingView {
  return {
    ...toListingCard(doc),
    branchName: doc.location.branchName ?? null,
    stats: {
      views: doc.stats?.views ?? 0,
      leads: doc.stats?.leads ?? 0,
      favorites: doc.stats?.favorites ?? 0,
    },
    expiresAt: doc.expiresAt ?? null,
    rejectionReason: doc.rejectionReason ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toListingDetail(doc: ListingDetailLean): ListingDetailView {
  const loc = doc.location;
  const s = doc.sellerSnapshot;
  return {
    id: doc._id.toString(),
    sellerId: doc.seller.toString(),
    seller: {
      name: s.name,
      businessName: s.businessName ?? null,
      city: s.city ?? null,
      verified: s.verified,
    },
    branchId: doc.branch?.toString() ?? null,
    title: doc.title,
    make: doc.make,
    makeSlug: doc.makeSlug,
    model: doc.model,
    modelSlug: doc.modelSlug,
    variant: doc.variant ?? null,
    year: doc.year,
    kmDriven: doc.kmDriven,
    fuelType: doc.fuelType,
    transmission: doc.transmission,
    bodyType: doc.bodyType ?? null,
    ownerCount: doc.ownerCount,
    color: doc.color ?? null,
    price: doc.price,
    negotiable: doc.negotiable,
    registrationState: doc.registrationState ?? null,
    insuranceValidTill: doc.insuranceValidTill ?? null,
    description: doc.description ?? null,
    features: doc.features ?? [],
    location: {
      branchName: loc.branchName ?? null,
      addressLine: loc.addressLine ?? null,
      city: loc.city,
      state: loc.state ?? null,
      locality: loc.locality ?? null,
      pincode: loc.pincode ?? null,
      lng: loc.geo?.coordinates[0] ?? null,
      lat: loc.geo?.coordinates[1] ?? null,
    },
    images: (doc.images ?? []).map((img) => ({
      id: img.mediaId.toString(),
      url: img.url,
      thumbUrl: img.thumbUrl,
      width: img.width,
      height: img.height,
    })),
    status: doc.status,
    rejectionReason: doc.rejectionReason ?? null,
    publishedAt: doc.publishedAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    soldAt: doc.soldAt ?? null,
    views: doc.stats?.views ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
