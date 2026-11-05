import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CursorPage,
  KeysetSort,
  keysetSortSpec,
  toCursorPage,
  withCursor,
} from '../../common/pagination/cursor';
import {
  LISTING_CARD_PROJECTION,
  ListingCardLean,
  ListingCardView,
  toListingCard,
} from '../listings/listings.mapper';
import { Listing, ListingStatus } from '../listings/schemas/listing.schema';
import { Favorite } from './schemas/favorite.schema';

const NEWEST: KeysetSort = { field: 'createdAt', direction: -1 };

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favorites: Model<Favorite>,
    @InjectModel(Listing.name) private readonly listings: Model<Listing>,
  ) {}

  /** Idempotent: saving twice is a no-op and doesn't double-count. */
  async add(userId: Types.ObjectId, listingId: Types.ObjectId): Promise<void> {
    const exists = await this.listings.exists({ _id: listingId, status: ListingStatus.Active });
    if (!exists) throw new NotFoundException('Listing not found');
    try {
      const res = await this.favorites
        .updateOne(
          { user: userId, listing: listingId },
          { $setOnInsert: { user: userId, listing: listingId } },
          { upsert: true },
        )
        .exec();
      if (res.upsertedCount) await this.bumpCount(listingId, 1);
    } catch (err) {
      // Concurrent upserts race on the unique index; the other request won.
      if (!isDuplicateKey(err)) throw err;
    }
  }

  async remove(userId: Types.ObjectId, listingId: Types.ObjectId): Promise<void> {
    const res = await this.favorites.deleteOne({ user: userId, listing: listingId }).exec();
    if (res.deletedCount) await this.bumpCount(listingId, -1);
  }

  /**
   * Which of `listingIds` the user has saved — one index-covered query for a whole
   * page of results (the classic N+1 spot when rendering hearts on cards).
   */
  async favoritedAmong(userId: string, listingIds: string[]): Promise<Set<string>> {
    if (listingIds.length === 0) return new Set();
    const rows = await this.favorites
      .find(
        {
          user: new Types.ObjectId(userId),
          listing: { $in: listingIds.map((id) => new Types.ObjectId(id)) },
        },
        { listing: 1, _id: 0 },
      )
      .lean<{ listing: Types.ObjectId }[]>()
      .exec();
    return new Set(rows.map((r) => r.listing.toString()));
  }

  async isFavorited(userId: string, listingId: string): Promise<boolean> {
    return (await this.favoritedAmong(userId, [listingId])).has(listingId);
  }

  /** Saved cars, newest first. Two queries per page regardless of page size. */
  async list(
    userId: Types.ObjectId,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ListingCardView>> {
    const favs = await this.favorites
      .find(withCursor({ user: userId }, NEWEST, cursor), { listing: 1, createdAt: 1 })
      .sort(keysetSortSpec(NEWEST))
      .limit(limit + 1)
      .lean<{ _id: Types.ObjectId; listing: Types.ObjectId; createdAt: Date }[]>()
      .exec();
    const page = toCursorPage(favs, limit, NEWEST, (f) => f);

    const listings = await this.listings
      .find(
        { _id: { $in: page.items.map((f) => f.listing) }, status: { $ne: ListingStatus.Deleted } },
        LISTING_CARD_PROJECTION,
      )
      .lean<ListingCardLean[]>()
      .exec();
    const byId = new Map(listings.map((l) => [l._id.toString(), l]));

    return {
      // Sold/expired cars stay visible (with their status) so buyers know what happened.
      items: page.items.flatMap((f) => {
        const listing = byId.get(f.listing.toString());
        return listing ? [{ ...toListingCard(listing), isFavorited: true }] : [];
      }),
      nextCursor: page.nextCursor,
    };
  }

  private async bumpCount(listingId: Types.ObjectId, by: 1 | -1): Promise<void> {
    await this.listings.updateOne({ _id: listingId }, { $inc: { 'stats.favorites': by } }).exec();
  }
}
