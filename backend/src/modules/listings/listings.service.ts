import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilterQuery, Model, PipelineStage, Types, UpdateQuery } from 'mongoose';
import { AppConfig } from '../../config/app-config';
import { InjectConfig } from '../../config/config.module';
import { Events, SellerProfileChangedEvent, UserSuspendedEvent } from '../../common/events';
import {
  CursorPage,
  KeysetSort,
  keysetSortSpec,
  toCursorPage,
  withCursor,
} from '../../common/pagination/cursor';
import { AuthUser, Role } from '../../common/types/auth';
import { CacheService } from '../../infra/cache/cache.service';
import { DistributedLockService } from '../../infra/redis/distributed-lock.service';
import { CatalogService } from '../catalog/catalog.service';
import { FavoritesService } from '../favorites/favorites.service';
import { MediaService } from '../media/media.service';
import { DealerBranch, UserStatus } from '../users/schemas/user.schema';
import { PublicBranchView, toPublicBranch, UserView } from '../users/users.mapper';
import { SellerSnapshotSource, UsersService } from '../users/users.service';
import {
  CreateListingDto,
  ListingSort,
  MyListingsQueryDto,
  SearchListingsDto,
  UpdateListingDto,
} from './dto/listing.dto';
import { ListingViewsService } from './listing-views.service';
import {
  LISTING_CARD_PROJECTION,
  LISTING_DETAIL_PROJECTION,
  ListingCardLean,
  ListingCardView,
  ListingDetailLean,
  ListingDetailView,
  OWNER_LISTING_PROJECTION,
  OwnerListingLean,
  OwnerListingView,
  toListingCard,
  toListingDetail,
  toOwnerListing,
} from './listings.mapper';
import { Listing, ListingLocation, ListingStatus, SellerSnapshot } from './schemas/listing.schema';

const SORTS: Record<ListingSort, KeysetSort> = {
  [ListingSort.Newest]: { field: 'publishedAt', direction: -1 },
  [ListingSort.PriceAsc]: { field: 'price', direction: 1 },
  [ListingSort.PriceDesc]: { field: 'price', direction: -1 },
  [ListingSort.KmAsc]: { field: 'kmDriven', direction: 1 },
  [ListingSort.YearDesc]: { field: 'year', direction: -1 },
};
const MINE_SORT: KeysetSort = { field: 'createdAt', direction: -1 };
const MODERATION_SORT: KeysetSort = { field: 'createdAt', direction: 1 };

/** Counting is the expensive part of search; cap it ("10,000+ cars") and cache briefly. */
const COUNT_CAP = 10_000;
const COUNT_TTL = 60;
const FACETS_TTL = 300;
const DETAIL_TTL = 120;
const SIMILAR_TTL = 600;
const SELLER_TTL = 300;
const EARTH_RADIUS_KM = 6378.1;

const detailKey = (id: Types.ObjectId | string) => `listing:${id.toString()}`;
const filterHash = (filter: unknown) =>
  createHash('sha1').update(JSON.stringify(filter)).digest('base64url');

export interface ListingFacets {
  makes: { slug: string; count: number }[];
  fuelTypes: { value: string; count: number }[];
  transmissions: { value: string; count: number }[];
  bodyTypes: { value: string; count: number }[];
  cities: { slug: string; name: string; count: number }[];
}

export interface SellerPublicProfile {
  id: string;
  name: string;
  businessName: string | null;
  city: string | null;
  verified: boolean;
  memberSince: Date;
  activeListings: number;
  branches: PublicBranchView[];
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectModel(Listing.name) private readonly listings: Model<Listing>,
    @InjectConfig() private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly media: MediaService,
    private readonly catalog: CatalogService,
    private readonly favorites: FavoritesService,
    private readonly cache: CacheService,
    private readonly views: ListingViewsService,
    private readonly locks: DistributedLockService,
  ) {}

  // ---------------------------------------------------------------- public reads

  /**
   * Search: one indexed find (limit+1 for hasMore), one cached capped count on the
   * first page, one batched favourites lookup. Constant query count per page.
   */
  async search(dto: SearchListingsDto, viewer?: AuthUser): Promise<CursorPage<ListingCardView>> {
    const filter = this.buildSearchFilter(dto);
    const sort = SORTS[dto.sort];

    const [docs, total] = await Promise.all([
      this.listings
        .find(withCursor(filter, sort, dto.cursor), LISTING_CARD_PROJECTION)
        .sort(keysetSortSpec(sort))
        .limit(dto.limit + 1)
        .lean<ListingCardLean[]>()
        .exec(),
      dto.cursor ? undefined : this.countCapped(filter),
    ]);

    const page = toCursorPage(docs, dto.limit, sort, toListingCard);
    if (total !== undefined) {
      page.total = total;
      page.totalIsCapped = total >= COUNT_CAP;
    }
    await this.markFavorites(page.items, viewer);
    return page;
  }

  /** Filter counts for the search sidebar, cached per filter. */
  facets(dto: SearchListingsDto): Promise<ListingFacets> {
    const filter = this.buildSearchFilter(dto);
    return this.cache.wrap(`listings:facets:${filterHash(filter)}`, FACETS_TTL, async () => {
      const group = (field: string, limit = 50): PipelineStage.FacetPipelineStage[] => [
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: limit },
      ];
      const [result] = await this.listings.aggregate<
        Record<string, { _id: string; count: number; name?: string }[]>
      >([
        { $match: filter },
        {
          $facet: {
            makes: group('makeSlug'),
            fuelTypes: group('fuelType'),
            transmissions: group('transmission'),
            bodyTypes: group('bodyType'),
            cities: [
              {
                $group: {
                  _id: '$location.citySlug',
                  name: { $first: '$location.city' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1, _id: 1 } },
              { $limit: 50 },
            ],
          },
        },
      ]);
      return {
        makes: result.makes.map((r) => ({ slug: r._id, count: r.count })),
        fuelTypes: result.fuelTypes.map((r) => ({ value: r._id, count: r.count })),
        transmissions: result.transmissions.map((r) => ({ value: r._id, count: r.count })),
        bodyTypes: result.bodyTypes.map((r) => ({ value: r._id, count: r.count })),
        cities: result.cities.map((r) => ({ slug: r._id, name: r.name ?? r._id, count: r.count })),
      };
    });
  }

  private activeDetail(id: Types.ObjectId): Promise<ListingDetailView | null> {
    return this.cache.wrap<ListingDetailView | null>(detailKey(id), DETAIL_TTL, async () => {
      const doc = await this.listings
        .findOne({ _id: id, status: ListingStatus.Active }, LISTING_DETAIL_PROJECTION)
        .lean<ListingDetailLean>()
        .exec();
      return doc ? toListingDetail(doc) : null; // null is cached too: cheap 404s
    });
  }

  /**
   * Public detail page. Active listings are served from cache; owners and admins can
   * also see their non-public listings (uncached). Reading never counts a view, so the
   * response is safe to prefetch and to cache in browsers/CDNs.
   */
  async getPublic(id: Types.ObjectId, viewer: AuthUser | undefined): Promise<ListingDetailView> {
    let detail = await this.activeDetail(id);

    if (!detail && viewer) {
      const doc = await this.listings
        .findOne({ _id: id, status: { $ne: ListingStatus.Deleted } }, LISTING_DETAIL_PROJECTION)
        .lean<ListingDetailLean>()
        .exec();
      if (doc && (viewer.role === Role.Admin || doc.seller.toString() === viewer.id)) {
        detail = toListingDetail(doc);
      }
    }
    if (!detail) throw new NotFoundException('Listing not found');
    return {
      ...detail,
      isFavorited: viewer ? await this.favorites.isFavorited(viewer.id, detail.id) : undefined,
    };
  }

  /**
   * Explicit view beacon, sent when the detail page is actually shown. Uses the cached
   * detail, so it normally costs no database query; counting is buffered and de-duplicated.
   */
  async recordView(
    id: Types.ObjectId,
    viewer: AuthUser | undefined,
    client: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const detail = await this.activeDetail(id);
    if (!detail || detail.sellerId === viewer?.id) return;
    this.views.record(
      detail.id,
      ListingViewsService.viewerKey(viewer?.id, client.ip, client.userAgent),
    );
  }

  async similar(id: Types.ObjectId, viewer?: AuthUser): Promise<ListingCardView[]> {
    const items = await this.cache.wrap(
      `listing:${id.toString()}:similar`,
      SIMILAR_TTL,
      async () => {
        const base = await this.listings
          .findOne(
            { _id: id, status: ListingStatus.Active },
            { makeSlug: 1, modelSlug: 1, bodyType: 1, price: 1 },
          )
          .lean()
          .exec();
        if (!base) return [];

        const limit = 8;
        const sameModel = await this.listings
          .find(
            {
              status: ListingStatus.Active,
              makeSlug: base.makeSlug,
              modelSlug: base.modelSlug,
              _id: { $ne: id },
            },
            LISTING_CARD_PROJECTION,
          )
          .sort({ publishedAt: -1, _id: -1 })
          .limit(limit)
          .lean<ListingCardLean[]>()
          .exec();

        let rest: ListingCardLean[] = [];
        if (sameModel.length < limit && base.bodyType) {
          rest = await this.listings
            .find(
              {
                status: ListingStatus.Active,
                bodyType: base.bodyType,
                _id: { $nin: [id, ...sameModel.map((d) => d._id)] },
                price: { $gte: Math.floor(base.price * 0.75), $lte: Math.ceil(base.price * 1.25) },
              },
              LISTING_CARD_PROJECTION,
            )
            .sort({ publishedAt: -1, _id: -1 })
            .limit(limit - sameModel.length)
            .lean<ListingCardLean[]>()
            .exec();
        }
        return [...sameModel, ...rest].map(toListingCard);
      },
    );
    await this.markFavorites(items, viewer);
    return items;
  }

  async sellerProfile(sellerId: Types.ObjectId): Promise<SellerPublicProfile> {
    const profile = await this.cache.wrap<SellerPublicProfile | null>(
      `seller:${sellerId.toString()}`,
      SELLER_TTL,
      async () => {
        const [seller, activeListings] = await Promise.all([
          this.users.findSnapshotSource(sellerId),
          this.listings.countDocuments({ seller: sellerId, status: ListingStatus.Active }).exec(),
        ]);
        if (!seller?.sellerProfile || seller.status !== UserStatus.Active) return null;
        const sp = seller.sellerProfile;
        const branches = sp.branches ?? [];
        return {
          id: seller._id.toString(),
          name: seller.name,
          businessName: sp.businessName ?? null,
          city: branches[0]?.city ?? null,
          verified: sp.verified,
          memberSince: seller._id.getTimestamp(),
          activeListings,
          branches: branches.map(toPublicBranch),
        };
      },
    );
    if (!profile) throw new NotFoundException('Seller not found');
    return profile;
  }

  async sellerListings(
    sellerId: Types.ObjectId,
    cursor: string | undefined,
    limit: number,
    viewer?: AuthUser,
  ): Promise<CursorPage<ListingCardView>> {
    const sort = SORTS[ListingSort.Newest];
    const docs = await this.listings
      .find(
        withCursor({ seller: sellerId, status: ListingStatus.Active }, sort, cursor),
        LISTING_CARD_PROJECTION,
      )
      .sort(keysetSortSpec(sort))
      .limit(limit + 1)
      .lean<ListingCardLean[]>()
      .exec();
    const page = toCursorPage(docs, limit, sort, toListingCard);
    await this.markFavorites(page.items, viewer);
    return page;
  }

  /** Used by leads: listing must be live; returns what a lead snapshots. */
  async getActiveForLead(id: Types.ObjectId) {
    const listing = await this.listings
      .findOne(
        { _id: id, status: ListingStatus.Active },
        { seller: 1, branch: 1, location: 1, title: 1, price: 1, coverThumbUrl: 1 },
      )
      .lean<
        Pick<Listing, 'seller' | 'branch' | 'location' | 'title' | 'price' | 'coverThumbUrl'> & {
          _id: Types.ObjectId;
        }
      >()
      .exec();
    if (!listing) throw new NotFoundException('Listing not found or no longer available');
    return listing;
  }

  async incrementLeads(id: Types.ObjectId): Promise<void> {
    await this.listings.updateOne({ _id: id }, { $inc: { 'stats.leads': 1 } }).exec();
  }

  // ---------------------------------------------------------------- seller writes

  async create(sellerId: Types.ObjectId, dto: CreateListingDto): Promise<OwnerListingView> {
    const seller = await this.users.findSnapshotSource(sellerId);
    if (!seller || seller.status !== UserStatus.Active)
      throw new ForbiddenException('Account is not active');
    if (!seller.sellerProfile)
      throw new ForbiddenException('Create a dealer profile before listing a car');

    const branch = this.branchOf(seller, dto.branchId);
    const { make, model } = this.resolveModel(dto.makeSlug, dto.modelSlug);
    this.validateDetails(dto);

    const _id = new Types.ObjectId();
    const images = await this.media.attach(sellerId, dto.imageIds, _id);
    const publish = dto.publish ?? true;
    if (publish && images.length === 0)
      throw new BadRequestException('Add at least one photo to publish');

    const now = new Date();
    const status = !publish
      ? ListingStatus.Draft
      : this.config.listings.moderation
        ? ListingStatus.Pending
        : ListingStatus.Active;

    try {
      const doc = await this.listings.create({
        _id,
        seller: sellerId,
        sellerSnapshot: this.toSnapshot(seller),
        branch: branch._id,
        title: this.title(dto.year, make.name, model.name, dto.variant),
        make: make.name,
        makeSlug: make.slug,
        model: model.name,
        modelSlug: model.slug,
        variant: dto.variant || undefined,
        year: dto.year,
        kmDriven: dto.kmDriven,
        fuelType: dto.fuelType,
        transmission: dto.transmission,
        bodyType: dto.bodyType,
        ownerCount: dto.ownerCount,
        color: dto.color || undefined,
        price: dto.price,
        negotiable: dto.negotiable ?? true,
        registrationState: dto.registrationState,
        insuranceValidTill: dto.insuranceValidTill ? new Date(dto.insuranceValidTill) : undefined,
        description: dto.description || undefined,
        features: [...new Set(dto.features ?? [])],
        location: this.toLocation(branch),
        images,
        coverThumbUrl: images[0]?.thumbUrl,
        status,
        ...(status === ListingStatus.Active
          ? { publishedAt: now, expiresAt: this.expiryFrom(now) }
          : {}),
      });
      return toOwnerListing(doc.toObject());
    } catch (err) {
      await this.media.detachExcept(_id, []).catch(() => undefined);
      throw err;
    }
  }

  async update(
    sellerId: Types.ObjectId,
    id: Types.ObjectId,
    dto: UpdateListingDto,
  ): Promise<OwnerListingView> {
    await this.users.assertActive(sellerId);
    const current = await this.listings
      .findOne(
        { _id: id, seller: sellerId, status: { $ne: ListingStatus.Deleted } },
        { status: 1, makeSlug: 1, modelSlug: 1, make: 1, model: 1, year: 1, variant: 1 },
      )
      .lean()
      .exec();
    if (!current) throw new NotFoundException('Listing not found');
    if (current.status === ListingStatus.Sold)
      throw new ConflictException('Sold listings cannot be edited');
    this.validateDetails(dto);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    const setOrUnset = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === '' || value === null) $unset[key] = 1;
      else $set[key] = value;
    };

    // Required fields: null/undefined mean "unchanged" (class-validator's @IsOptional lets null through).
    for (const key of [
      'kmDriven',
      'fuelType',
      'transmission',
      'ownerCount',
      'price',
      'negotiable',
    ] as const) {
      if (dto[key] !== undefined && dto[key] !== null) $set[key] = dto[key];
    }
    // Optional fields: null or '' clears them.
    setOrUnset('bodyType', dto.bodyType);
    setOrUnset('color', dto.color);
    setOrUnset('description', dto.description);
    setOrUnset('registrationState', dto.registrationState);
    setOrUnset(
      'insuranceValidTill',
      dto.insuranceValidTill ? new Date(dto.insuranceValidTill) : dto.insuranceValidTill,
    );
    if (dto.features !== undefined && dto.features !== null)
      $set.features = [...new Set(dto.features)];
    if (dto.branchId) {
      const branch = this.branchOf(await this.users.findSnapshotSource(sellerId), dto.branchId);
      $set.branch = branch._id;
      $set.location = this.toLocation(branch);
    }

    let make = current.make;
    let model = current.model;
    if (dto.makeSlug !== undefined || dto.modelSlug !== undefined) {
      const resolved = this.resolveModel(
        dto.makeSlug ?? current.makeSlug,
        dto.modelSlug ?? current.modelSlug,
      );
      make = resolved.make.name;
      model = resolved.model.name;
      Object.assign($set, {
        make,
        makeSlug: resolved.make.slug,
        model,
        modelSlug: resolved.model.slug,
      });
    }
    setOrUnset('variant', dto.variant);
    if (dto.year !== undefined && dto.year !== null) $set.year = dto.year;
    if ($set.make || $set.year !== undefined || dto.variant !== undefined) {
      const variant = dto.variant !== undefined ? dto.variant : current.variant;
      $set.title = this.title((dto.year ?? current.year) as number, make, model, variant);
    }

    let keepMedia: Types.ObjectId[] | undefined;
    if (dto.imageIds !== undefined) {
      const images = await this.media.attach(sellerId, dto.imageIds, id);
      const live = [ListingStatus.Active, ListingStatus.Pending].includes(current.status);
      if (images.length === 0 && live)
        throw new BadRequestException('A live listing needs at least one photo');
      $set.images = images;
      if (images[0]) $set.coverThumbUrl = images[0].thumbUrl;
      else $unset.coverThumbUrl = 1;
      keepMedia = images.map((i) => i.mediaId);
    }

    const update: UpdateQuery<Listing> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await this.listings
      .findOneAndUpdate({ _id: id, seller: sellerId }, update, {
        new: true,
        runValidators: true,
        projection: OWNER_LISTING_PROJECTION,
      })
      .lean<OwnerListingLean>()
      .exec();
    if (!updated) throw new NotFoundException('Listing not found');

    if (keepMedia) await this.media.detachExcept(id, keepMedia);
    await this.invalidate(id);
    return toOwnerListing(updated);
  }

  async mine(
    sellerId: Types.ObjectId,
    query: MyListingsQueryDto,
  ): Promise<CursorPage<OwnerListingView>> {
    const filter: FilterQuery<Listing> = query.status
      ? { seller: sellerId, status: query.status }
      : { seller: sellerId, status: { $ne: ListingStatus.Deleted } };
    const docs = await this.listings
      .find(withCursor(filter, MINE_SORT, query.cursor), OWNER_LISTING_PROJECTION)
      .sort(keysetSortSpec(MINE_SORT))
      .limit(query.limit + 1)
      .lean<OwnerListingLean[]>()
      .exec();
    return toCursorPage(docs, query.limit, MINE_SORT, toOwnerListing);
  }

  /** Full listing for the seller's edit form, any non-deleted status. */
  async getOwned(
    sellerId: Types.ObjectId,
    id: Types.ObjectId,
  ): Promise<ListingDetailView & { stats: Listing['stats'] }> {
    const { 'stats.views': _views, ...projection } = LISTING_DETAIL_PROJECTION;
    const doc = await this.listings
      .findOne(
        { _id: id, seller: sellerId, status: { $ne: ListingStatus.Deleted } },
        { ...projection, stats: 1 },
      )
      .lean<ListingDetailLean & { stats: Listing['stats'] }>()
      .exec();
    if (!doc) throw new NotFoundException('Listing not found');
    return { ...toListingDetail(doc), stats: doc.stats };
  }

  async sellerStats(sellerId: Types.ObjectId) {
    const rows = await this.listings.aggregate<{
      _id: ListingStatus;
      count: number;
      views: number;
      leads: number;
    }>([
      { $match: { seller: sellerId, status: { $ne: ListingStatus.Deleted } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          views: { $sum: '$stats.views' },
          leads: { $sum: '$stats.leads' },
        },
      },
    ]);
    return {
      byStatus: Object.fromEntries(rows.map((r) => [r._id, r.count])),
      totalViews: rows.reduce((n, r) => n + r.views, 0),
      totalLeads: rows.reduce((n, r) => n + r.leads, 0),
    };
  }

  /** Sold cars keep their copied address, so only cars that can still go live block removal. */
  async removeBranch(sellerId: Types.ObjectId, branchId: Types.ObjectId): Promise<UserView> {
    const cars = await this.listings
      .countDocuments({
        seller: sellerId,
        branch: branchId,
        status: { $nin: [ListingStatus.Sold, ListingStatus.Deleted] },
      })
      .exec();
    if (cars > 0) {
      throw new ConflictException(
        `Move or remove the ${cars === 1 ? 'car' : `${cars} cars`} at this branch first`,
      );
    }
    return this.users.removeBranch(sellerId, branchId);
  }

  // ---------------------------------------------------------------- lifecycle

  async publish(sellerId: Types.ObjectId, id: Types.ObjectId): Promise<OwnerListingView> {
    await this.users.assertActive(sellerId);
    const current = await this.listings
      .findOne({ _id: id, seller: sellerId }, { status: 1 })
      .lean();
    // A car an admin took down goes back through review, so one click can't undo a take-down.
    const review = this.config.listings.moderation || current?.status === ListingStatus.Rejected;
    const from = [ListingStatus.Draft, ListingStatus.Inactive, ListingStatus.Expired];
    return this.transition(
      {
        _id: id,
        seller: sellerId,
        status: { $in: review ? [...from, ListingStatus.Rejected] : from },
        'images.0': { $exists: true },
      },
      review
        ? [{ $set: { status: ListingStatus.Pending, rejectionReason: '$$REMOVE' } }]
        : this.activationPipeline(),
    );
  }

  deactivate(sellerId: Types.ObjectId, id: Types.ObjectId): Promise<OwnerListingView> {
    return this.transition(
      { _id: id, seller: sellerId, status: { $in: [ListingStatus.Active, ListingStatus.Pending] } },
      { $set: { status: ListingStatus.Inactive } },
    );
  }

  markSold(sellerId: Types.ObjectId, id: Types.ObjectId): Promise<OwnerListingView> {
    return this.transition(
      {
        _id: id,
        seller: sellerId,
        status: {
          $in: [
            ListingStatus.Active,
            ListingStatus.Inactive,
            ListingStatus.Pending,
            ListingStatus.Expired,
          ],
        },
      },
      { $set: { status: ListingStatus.Sold, soldAt: new Date() } },
    );
  }

  async remove(sellerId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    await this.transition(
      { _id: id, seller: sellerId, status: { $ne: ListingStatus.Deleted } },
      { $set: { status: ListingStatus.Deleted } },
    );
    // Images become orphans and are removed from storage by the cleanup job.
    await this.media.detachExcept(id, []);
  }

  // ---------------------------------------------------------------- admin

  async moderationQueue(status: ListingStatus, cursor: string | undefined, limit: number) {
    const docs = await this.listings
      .find(withCursor({ status }, MODERATION_SORT, cursor), {
        ...OWNER_LISTING_PROJECTION,
        seller: 1,
      })
      .sort(keysetSortSpec(MODERATION_SORT))
      .limit(limit + 1)
      .lean<(OwnerListingLean & { seller: Types.ObjectId })[]>()
      .exec();
    return toCursorPage(docs, limit, MODERATION_SORT, (d) => ({
      ...toOwnerListing(d),
      sellerId: d.seller.toString(),
    }));
  }

  approve(id: Types.ObjectId): Promise<OwnerListingView> {
    return this.transition({ _id: id, status: ListingStatus.Pending }, this.activationPipeline());
  }

  reject(id: Types.ObjectId, reason: string): Promise<OwnerListingView> {
    return this.transition(
      { _id: id, status: { $in: [ListingStatus.Pending, ListingStatus.Active] } },
      { $set: { status: ListingStatus.Rejected, rejectionReason: reason } },
    );
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.listings.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  // ---------------------------------------------------------------- events & jobs

  /** Keeps the denormalised seller and branch data in sync: one bulk write per profile change. */
  @OnEvent(Events.SellerProfileChanged, { promisify: true })
  async onSellerProfileChanged({ userId }: SellerProfileChangedEvent): Promise<void> {
    const seller = await this.users.findSnapshotSource(userId);
    if (!seller?.sellerProfile) return;
    const branches = seller.sellerProfile.branches ?? [];
    const sync = (filter: FilterQuery<Listing>, $set: UpdateQuery<Listing>['$set']) => ({
      updateMany: { filter: { seller: userId, ...filter }, update: { $set } },
    });
    await this.listings.bulkWrite([
      sync({}, { sellerSnapshot: this.toSnapshot(seller) }),
      // Cars listed before dealers had addresses go to the first branch the dealer adds.
      ...branches.slice(0, 1).map((b) => sync({ branch: { $exists: false } }, { branch: b._id })),
      ...branches.map((b) => sync({ branch: b._id }, { location: this.toLocation(b) })),
    ]);
    await this.cache.del(`seller:${userId.toString()}`);
  }

  @OnEvent(Events.UserSuspended, { promisify: true })
  async onUserSuspended({ userId }: UserSuspendedEvent): Promise<void> {
    const filter = {
      seller: userId,
      status: { $in: [ListingStatus.Active, ListingStatus.Pending] },
    };
    const hidden = await this.listings.find(filter, { _id: 1 }).lean().exec();
    await this.listings.updateMany(filter, { $set: { status: ListingStatus.Inactive } }).exec();
    await this.cache.del(`seller:${userId.toString()}`, ...hidden.map((l) => detailKey(l._id)));
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'listing-expiry' })
  async expireListings(): Promise<void> {
    await this.locks.runExclusive('listing-expiry', 5 * 60_000, async () => {
      const res = await this.listings
        .updateMany(
          { status: ListingStatus.Active, expiresAt: { $lte: new Date() } },
          { $set: { status: ListingStatus.Expired } },
        )
        .exec();
      if (res.modifiedCount) this.logger.log(`Expired ${res.modifiedCount} listings`);
    });
  }

  // ---------------------------------------------------------------- helpers

  buildSearchFilter(dto: SearchListingsDto): FilterQuery<Listing> {
    const f: FilterQuery<Listing> = { status: ListingStatus.Active };
    const oneOrIn = <T>(values: T[]) => (values.length === 1 ? values[0] : { $in: values });

    if (dto.q) f.$text = { $search: dto.q };
    if (dto.city) f['location.citySlug'] = dto.city;
    if (dto.make?.length) f.makeSlug = oneOrIn(dto.make);
    if (dto.model?.length) f.modelSlug = oneOrIn(dto.model);
    if (dto.fuel?.length) f.fuelType = oneOrIn(dto.fuel);
    if (dto.transmission) f.transmission = dto.transmission;
    if (dto.body?.length) f.bodyType = oneOrIn(dto.body);

    const range = (field: string, min?: number, max?: number) => {
      if (min !== undefined && max !== undefined && min > max) {
        throw new BadRequestException(`Invalid ${field} range`);
      }
      if (min === undefined && max === undefined) return;
      f[field] = {
        ...(min !== undefined && { $gte: min }),
        ...(max !== undefined && { $lte: max }),
      };
    };
    range('price', dto.minPrice, dto.maxPrice);
    range('year', dto.minYear, dto.maxYear);
    range('kmDriven', undefined, dto.maxKm);
    range('ownerCount', undefined, dto.maxOwners);

    if (dto.lat !== undefined && dto.lng !== undefined && dto.radiusKm !== undefined) {
      f['location.geo'] = {
        $geoWithin: { $centerSphere: [[dto.lng, dto.lat], dto.radiusKm / EARTH_RADIUS_KM] },
      };
    }
    return f;
  }

  private countCapped(filter: FilterQuery<Listing>): Promise<number> {
    return this.cache.wrap(`listings:count:${filterHash(filter)}`, COUNT_TTL, () =>
      this.listings.countDocuments(filter, { limit: COUNT_CAP }).exec(),
    );
  }

  private async markFavorites(items: ListingCardView[], viewer?: AuthUser): Promise<void> {
    if (!viewer || items.length === 0) return;
    const saved = await this.favorites.favoritedAmong(
      viewer.id,
      items.map((i) => i.id),
    );
    for (const item of items) item.isFavorited = saved.has(item.id);
  }

  /** Atomic conditional state change; diagnoses why it failed only on the error path. */
  private async transition(
    filter: FilterQuery<Listing>,
    update: UpdateQuery<Listing> | PipelineStage[],
  ): Promise<OwnerListingView> {
    const updated = await this.listings
      .findOneAndUpdate(filter, update as UpdateQuery<Listing>, {
        new: true,
        projection: OWNER_LISTING_PROJECTION,
      })
      .lean<OwnerListingLean>()
      .exec();
    if (updated) {
      await this.invalidate(updated._id);
      return toOwnerListing(updated);
    }

    const scope: FilterQuery<Listing> = { _id: filter._id };
    if (filter.seller) scope.seller = filter.seller;
    const existing = await this.listings
      .findOne(scope, { status: 1, coverThumbUrl: 1 })
      .lean()
      .exec();
    if (!existing || existing.status === ListingStatus.Deleted)
      throw new NotFoundException('Listing not found');
    if (filter['images.0'] && !existing.coverThumbUrl) {
      throw new BadRequestException('Add at least one photo before publishing');
    }
    throw new ConflictException(`Not allowed while listing is ${existing.status}`);
  }

  /**
   * Going live: re-activating a paused listing keeps its original publish date
   * (no "bump to top" by toggling); first publish or renewal after expiry gets a new one.
   */
  private activationPipeline(): PipelineStage[] {
    const now = new Date();
    return [
      {
        $set: {
          status: ListingStatus.Active,
          rejectionReason: '$$REMOVE',
          publishedAt: {
            $cond: [
              { $or: [{ $eq: ['$status', ListingStatus.Expired] }, { $not: ['$publishedAt'] }] },
              now,
              '$publishedAt',
            ],
          },
          expiresAt: {
            $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', this.expiryFrom(now)],
          },
        },
      },
    ];
  }

  private async invalidate(id: Types.ObjectId): Promise<void> {
    await this.cache.del(detailKey(id), `listing:${id.toString()}:similar`);
  }

  private resolveModel(makeSlug: string, modelSlug: string) {
    const resolved = this.catalog.resolveModel(makeSlug, modelSlug);
    if (!resolved) throw new BadRequestException('Unknown make/model');
    return resolved;
  }

  private validateDetails(dto: UpdateListingDto): void {
    const maxYear = new Date().getFullYear() + 1;
    if (dto.year !== undefined && dto.year > maxYear)
      throw new BadRequestException(`year must be ≤ ${maxYear}`);
    if (dto.imageIds && dto.imageIds.length > this.config.listings.maxImages) {
      throw new BadRequestException(`At most ${this.config.listings.maxImages} photos per listing`);
    }
    const unknown = dto.features?.filter((f) => !this.catalog.isKnownFeature(f));
    if (unknown?.length) throw new BadRequestException(`Unknown features: ${unknown.join(', ')}`);
    if (dto.registrationState && !this.catalog.isKnownState(dto.registrationState)) {
      throw new BadRequestException('Unknown registrationState');
    }
  }

  private branchOf(seller: SellerSnapshotSource | null, branchId: string): DealerBranch {
    const branch = seller?.sellerProfile?.branches?.find((b) => b._id.equals(branchId));
    if (!branch) throw new BadRequestException('Select one of your branches');
    return branch;
  }

  /** Built without undefined keys because bulk writes store this whole object as given. */
  private toLocation(branch: DealerBranch): ListingLocation {
    return {
      branchName: branch.name,
      addressLine: branch.addressLine,
      city: branch.city,
      citySlug: branch.citySlug,
      state: branch.state,
      pincode: branch.pincode,
      ...(branch.locality && { locality: branch.locality }),
      ...(branch.lat !== undefined &&
        branch.lng !== undefined && {
          geo: { type: 'Point' as const, coordinates: [branch.lng, branch.lat] },
        }),
    };
  }

  private toSnapshot(seller: SellerSnapshotSource): SellerSnapshot {
    const sp = seller.sellerProfile!;
    return {
      name: seller.name,
      businessName: sp.businessName,
      city: sp.branches?.[0]?.city,
      verified: sp.verified,
    };
  }

  private title(year: number, make: string, model: string, variant?: string | null): string {
    return [year, make, model, variant].filter(Boolean).join(' ');
  }

  private expiryFrom(date: Date): Date {
    return new Date(date.getTime() + this.config.listings.ttlDays * 86_400_000);
  }
}
