/** Response shapes of the Car Sales API (mirrors backend mappers). */

export type Role = 'buyer' | 'seller' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type ListingStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'sold' | 'expired' | 'rejected';
export type LeadStatus = 'new' | 'contacted' | 'closed';
export type ListingSort = 'newest' | 'price_asc' | 'price_desc' | 'km_asc' | 'year_desc';

/** What anyone can see. Phone numbers come with an inquiry. */
export interface PublicBranch {
  id: string;
  name: string;
  addressLine: string;
  locality: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface DealerBranch extends PublicBranch {
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SellerProfile {
  businessName: string;
  branches: DealerBranch[];
  verified: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  sellerProfile: SellerProfile | null;
  createdAt: string;
}

export interface AuthPayload {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken?: string;
  user: User;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
  totalIsCapped?: boolean;
}

export interface ListingCard {
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
  status: ListingStatus;
  publishedAt: string | null;
  isFavorited?: boolean;
}

export interface ListingStats {
  views: number;
  leads: number;
  favorites: number;
}

export interface OwnerListing extends ListingCard {
  branchName: string | null;
  stats: ListingStats;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  sellerId?: string;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface ListingDetail {
  id: string;
  sellerId: string;
  seller: { name: string; businessName: string | null; city: string | null; verified: boolean };
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
  insuranceValidTill: string | null;
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
  images: ListingImage[];
  status: ListingStatus;
  rejectionReason: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  soldAt: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  isFavorited?: boolean;
  stats?: ListingStats;
}

export interface SellerPublicProfile {
  id: string;
  name: string;
  businessName: string | null;
  city: string | null;
  verified: boolean;
  memberSince: string;
  activeListings: number;
  branches: PublicBranch[];
}

export interface SellerStats {
  byStatus: Partial<Record<ListingStatus, number>>;
  totalViews: number;
  totalLeads: number;
}

export interface MediaItem {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

interface LeadBase {
  id: string;
  listing: {
    id: string;
    title: string;
    price: number;
    thumbUrl: string | null;
    branchName: string | null;
    address: string | null;
  };
  message: string | null;
  status: LeadStatus;
  createdAt: string;
  lastContactAt: string;
}

export interface SentLead extends LeadBase {
  seller: { name: string; phone: string; businessName: string | null };
}

export interface ReceivedLead extends LeadBase {
  buyer: { name: string; phone: string; email: string | null };
  sellerNote: string | null;
}

export interface Catalog {
  makes: { name: string; slug: string; models: { name: string; slug: string }[] }[];
  cities: { name: string; slug: string; state: string }[];
  registrationStates: { code: string; name: string }[];
  features: { slug: string; label: string }[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
}

/** Live-listing counts per filter value (GET /listings/facets). */
export interface ListingFacets {
  makes: { slug: string; count: number }[];
  fuelTypes: { value: string; count: number }[];
  transmissions: { value: string; count: number }[];
  bodyTypes: { value: string; count: number }[];
  cities: { slug: string; name: string; count: number }[];
}

export interface AdminStats {
  users: Partial<Record<Role, number>>;
  listings: Partial<Record<ListingStatus | 'deleted', number>>;
}
