import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BODY_TYPES,
  BodyType,
  FUEL_TYPES,
  FuelType,
  TRANSMISSIONS,
  Transmission,
} from '../../catalog/catalog.data';

export enum ListingStatus {
  Draft = 'draft',
  /** Awaiting admin approval (only when LISTING_MODERATION=true). */
  Pending = 'pending',
  Active = 'active',
  /** Hidden by the seller (or by the platform when a seller is suspended). */
  Inactive = 'inactive',
  Sold = 'sold',
  Expired = 'expired',
  Rejected = 'rejected',
  Deleted = 'deleted',
}

@Schema({ _id: false })
export class ListingImage {
  @Prop({ type: Types.ObjectId, required: true })
  mediaId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  thumbUrl: string;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;
}
const ListingImageSchema = SchemaFactory.createForClass(ListingImage);

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], required: true })
  type: 'Point';

  /** [longitude, latitude] */
  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}
const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

/**
 * Copied from the dealer branch so search and detail pages render without joining users.
 * Kept in sync via SellerProfileChanged events. Cars listed before dealers had addresses
 * have no branch name or address line until their dealer adds a branch.
 */
@Schema({ _id: false })
export class ListingLocation {
  @Prop({ trim: true, maxlength: 80 })
  branchName?: string;

  @Prop({ trim: true, maxlength: 200 })
  addressLine?: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  city: string;

  @Prop({ required: true })
  citySlug: string;

  @Prop({ trim: true, maxlength: 80 })
  state?: string;

  @Prop({ trim: true, maxlength: 120 })
  locality?: string;

  @Prop({ trim: true, maxlength: 10 })
  pincode?: string;

  @Prop({ type: GeoPointSchema })
  geo?: GeoPoint;
}
const ListingLocationSchema = SchemaFactory.createForClass(ListingLocation);

/**
 * Seller data copied onto each listing so search results render without
 * joining users (no N+1, no $lookup). Kept in sync via SellerProfileChanged events.
 */
@Schema({ _id: false })
export class SellerSnapshot {
  @Prop({ required: true })
  name: string;

  @Prop()
  businessName?: string;

  @Prop()
  city?: string;

  @Prop({ default: false })
  verified: boolean;
}
const SellerSnapshotSchema = SchemaFactory.createForClass(SellerSnapshot);

@Schema({ _id: false })
export class ListingStats {
  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  leads: number;

  @Prop({ default: 0 })
  favorites: number;
}
const ListingStatsSchema = SchemaFactory.createForClass(ListingStats);

@Schema({ collection: 'listings', timestamps: true })
export class Listing {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, required: true })
  seller: Types.ObjectId;

  @Prop({ type: SellerSnapshotSchema, required: true })
  sellerSnapshot: SellerSnapshot;

  /** The dealer branch the car is at. See ListingLocation for when this is absent. */
  @Prop({ type: Types.ObjectId })
  branch?: Types.ObjectId;

  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({ required: true })
  make: string;

  @Prop({ required: true })
  makeSlug: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  modelSlug: string;

  @Prop({ trim: true, maxlength: 80 })
  variant?: string;

  @Prop({ required: true, min: 1980 })
  year: number;

  @Prop({ required: true, min: 0 })
  kmDriven: number;

  @Prop({ type: String, enum: FUEL_TYPES, required: true })
  fuelType: FuelType;

  @Prop({ type: String, enum: TRANSMISSIONS, required: true })
  transmission: Transmission;

  @Prop({ type: String, enum: BODY_TYPES })
  bodyType?: BodyType;

  @Prop({ required: true, min: 1, max: 10 })
  ownerCount: number;

  @Prop({ trim: true, maxlength: 40 })
  color?: string;

  /** Asking price in whole rupees. */
  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  negotiable: boolean;

  @Prop({ uppercase: true, trim: true, maxlength: 2 })
  registrationState?: string;

  @Prop()
  insuranceValidTill?: Date;

  @Prop({ trim: true, maxlength: 5000 })
  description?: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ type: ListingLocationSchema, required: true })
  location: ListingLocation;

  @Prop({ type: [ListingImageSchema], default: [] })
  images: ListingImage[];

  /** Denormalised first image so cards never load the images array. */
  @Prop()
  coverThumbUrl?: string;

  @Prop({ type: String, enum: ListingStatus, default: ListingStatus.Draft })
  status: ListingStatus;

  @Prop({ maxlength: 500 })
  rejectionReason?: string;

  @Prop()
  publishedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop()
  soldAt?: Date;

  @Prop({ type: ListingStatsSchema, default: () => ({}) })
  stats: ListingStats;
}

export type ListingDocument = HydratedDocument<Listing>;
export const ListingSchema = SchemaFactory.createForClass(Listing);

/*
 * Index strategy
 * --------------
 * Public search always filters `status: 'active'`, so search indexes are PARTIAL on
 * active listings: sold/expired/deleted rows (which accumulate forever) never bloat them.
 * Each follows Equality -> Sort -> Range and ends in `_id` so keyset pagination
 * (sortField, _id) is an index walk. Compound indexes are walked in either direction,
 * so { price: 1, _id: 1 } serves both price_asc and price_desc.
 */
const active = { partialFilterExpression: { status: ListingStatus.Active } };

ListingSchema.index({ publishedAt: -1, _id: -1 }, active);
ListingSchema.index({ price: 1, _id: 1 }, active);
ListingSchema.index({ kmDriven: 1, _id: 1 }, active);
ListingSchema.index({ year: -1, _id: -1 }, active);
ListingSchema.index({ 'location.citySlug': 1, publishedAt: -1, _id: -1 }, active);
ListingSchema.index({ 'location.citySlug': 1, price: 1, _id: 1 }, active);
ListingSchema.index({ makeSlug: 1, modelSlug: 1, publishedAt: -1, _id: -1 }, active);
ListingSchema.index({ makeSlug: 1, modelSlug: 1, price: 1, _id: 1 }, active);
ListingSchema.index({ bodyType: 1, publishedAt: -1, _id: -1 }, active);
ListingSchema.index({ seller: 1, publishedAt: -1, _id: -1 }, active);
ListingSchema.index({ 'location.geo': '2dsphere' }, active);
ListingSchema.index(
  { title: 'text', variant: 'text', description: 'text' },
  { ...active, weights: { title: 10, variant: 5, description: 1 }, name: 'listing_text' },
);
// Expiry job.
ListingSchema.index({ expiresAt: 1 }, active);

// Seller dashboard ("my listings", any status).
ListingSchema.index({ seller: 1, status: 1, createdAt: -1, _id: -1 });
ListingSchema.index({ seller: 1, createdAt: -1, _id: -1 });
// Admin moderation queue.
ListingSchema.index({ status: 1, createdAt: 1, _id: 1 });
