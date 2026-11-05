import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ModifyResult, Types } from 'mongoose';
import { Events, LeadCreatedEvent } from '../../common/events';
import {
  CursorPage,
  KeysetSort,
  keysetSortSpec,
  toCursorPage,
  withCursor,
} from '../../common/pagination/cursor';
import { formatAddress } from '../listings/listings.mapper';
import { ListingsService } from '../listings/listings.service';
import { UserStatus } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateLeadDto, ReceivedLeadsQueryDto, UpdateLeadDto } from './dto/lead.dto';
import { Lead, LeadPartySnapshot, LeadStatus } from './schemas/lead.schema';

const RECENT: KeysetSort = { field: 'lastContactAt', direction: -1 };

type LeadLean = Lead;

export interface LeadView {
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
  createdAt: Date;
  lastContactAt: Date;
}

export interface ReceivedLeadView extends LeadView {
  buyer: { name: string; phone: string; email: string | null };
  sellerNote: string | null;
}

export interface SentLeadView extends LeadView {
  seller: { name: string; phone: string; businessName: string | null };
}

const base = (l: LeadLean): LeadView => ({
  id: l._id.toString(),
  listing: {
    id: l.listing.toString(),
    title: l.listingSnapshot.title,
    price: l.listingSnapshot.price,
    thumbUrl: l.listingSnapshot.thumbUrl ?? null,
    branchName: l.listingSnapshot.branchName ?? null,
    address: l.listingSnapshot.address ?? null,
  },
  message: l.message ?? null,
  status: l.status,
  createdAt: l.createdAt,
  lastContactAt: l.lastContactAt,
});

const toReceived = (l: LeadLean): ReceivedLeadView => ({
  ...base(l),
  buyer: {
    name: l.buyerSnapshot.name,
    phone: l.buyerSnapshot.phone,
    email: l.buyerSnapshot.email ?? null,
  },
  sellerNote: l.sellerNote ?? null,
});

const toSent = (l: LeadLean): SentLeadView => ({
  ...base(l),
  seller: {
    name: l.sellerSnapshot.name,
    phone: l.sellerSnapshot.phone,
    businessName: l.sellerSnapshot.businessName ?? null,
  },
});

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private readonly leads: Model<Lead>,
    private readonly listings: ListingsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Buyer contacts a dealer. Idempotent per (listing, buyer): a repeat inquiry updates
   * the existing lead instead of spamming the dealer's inbox. Returns the contact details
   * of the branch the car is at.
   */
  async create(buyerId: Types.ObjectId, dto: CreateLeadDto): Promise<SentLeadView> {
    const listingId = new Types.ObjectId(dto.listingId);
    const listing = await this.listings.getActiveForLead(listingId);
    if (listing.seller.equals(buyerId)) throw new BadRequestException('This is your own listing');

    const [buyer, seller] = await Promise.all([
      this.users.findContact(buyerId),
      this.users.findContact(listing.seller),
    ]);
    if (!buyer || !seller) throw new NotFoundException('Listing not found or no longer available');
    if (buyer.status !== UserStatus.Active) throw new ForbiddenException('Account is suspended');

    const branch = seller.sellerProfile?.branches?.find((b) => listing.branch?.equals(b._id));
    const sellerSnapshot: LeadPartySnapshot = {
      name: seller.name,
      phone: branch?.phone ?? seller.phone,
      email: seller.email,
      businessName: seller.sellerProfile?.businessName,
    };
    const update = {
      $set: {
        ...(dto.message ? { message: dto.message } : {}),
        status: LeadStatus.New,
        lastContactAt: new Date(),
        listingSnapshot: {
          title: listing.title,
          price: listing.price,
          thumbUrl: listing.coverThumbUrl,
          branchName: listing.location.branchName,
          address: formatAddress(listing.location),
        },
        buyerSnapshot: { name: buyer.name, phone: buyer.phone, email: buyer.email },
        sellerSnapshot,
      },
      $setOnInsert: { seller: listing.seller },
    };

    const upsert = () =>
      this.leads
        .findOneAndUpdate({ listing: listingId, buyer: buyerId }, update, {
          upsert: true,
          new: true,
          runValidators: true,
          includeResultMetadata: true,
          lean: true,
        })
        .exec() as Promise<ModifyResult<LeadLean>>;

    let result;
    try {
      result = await upsert();
    } catch (err) {
      // Two concurrent first inquiries race on the unique index; the retry updates the winner.
      if ((err as { code?: number }).code !== 11000) throw err;
      result = await upsert();
    }
    const lead = result.value as LeadLean;

    if (!result.lastErrorObject?.updatedExisting) {
      await this.listings.incrementLeads(listingId);
      this.events.emit(Events.LeadCreated, {
        leadId: lead._id,
        listingId,
        sellerId: listing.seller,
        buyerId,
      } satisfies LeadCreatedEvent);
    }
    return toSent(lead);
  }

  async received(
    sellerId: Types.ObjectId,
    query: ReceivedLeadsQueryDto,
  ): Promise<CursorPage<ReceivedLeadView>> {
    const filter: FilterQuery<Lead> = { seller: sellerId };
    if (query.status) filter.status = query.status;
    const docs = await this.leads
      .find(withCursor(filter, RECENT, query.cursor))
      .sort(keysetSortSpec(RECENT))
      .limit(query.limit + 1)
      .lean<LeadLean[]>()
      .exec();
    return toCursorPage(docs, query.limit, RECENT, toReceived);
  }

  async sent(
    buyerId: Types.ObjectId,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<SentLeadView>> {
    const docs = await this.leads
      .find(withCursor({ buyer: buyerId }, RECENT, cursor))
      .sort(keysetSortSpec(RECENT))
      .limit(limit + 1)
      .lean<LeadLean[]>()
      .exec();
    return toCursorPage(docs, limit, RECENT, toSent);
  }

  async update(
    sellerId: Types.ObjectId,
    id: Types.ObjectId,
    dto: UpdateLeadDto,
  ): Promise<ReceivedLeadView> {
    const $set: Partial<Lead> = {};
    if (dto.status) $set.status = dto.status;
    if (dto.sellerNote !== undefined) $set.sellerNote = dto.sellerNote;
    const lead = await this.leads
      .findOneAndUpdate({ _id: id, seller: sellerId }, { $set }, { new: true, runValidators: true })
      .lean<LeadLean>()
      .exec();
    if (!lead) throw new NotFoundException('Lead not found');
    return toReceived(lead);
  }

  async countNew(sellerId: Types.ObjectId): Promise<number> {
    return this.leads.countDocuments({ seller: sellerId, status: LeadStatus.New }).exec();
  }
}
