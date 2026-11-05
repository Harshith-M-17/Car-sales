import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum LeadStatus {
  New = 'new',
  Contacted = 'contacted',
  Closed = 'closed',
}

@Schema({ _id: false })
export class LeadListingSnapshot {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  thumbUrl?: string;

  @Prop()
  branchName?: string;

  @Prop()
  address?: string;
}

@Schema({ _id: false })
export class LeadPartySnapshot {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email?: string;

  @Prop()
  businessName?: string;
}

/**
 * A buyer's inquiry about a listing. One row per (listing, buyer): repeat inquiries
 * update it and bump `lastContactAt`. Listing and party details are snapshotted so
 * inboxes render with a single query and survive listing edits/deletion.
 */
@Schema({ collection: 'leads', timestamps: true })
export class Lead {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, required: true })
  listing: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  seller: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  buyer: Types.ObjectId;

  @Prop({ type: SchemaFactory.createForClass(LeadListingSnapshot), required: true })
  listingSnapshot: LeadListingSnapshot;

  @Prop({ type: SchemaFactory.createForClass(LeadPartySnapshot), required: true })
  buyerSnapshot: LeadPartySnapshot;

  @Prop({ type: SchemaFactory.createForClass(LeadPartySnapshot), required: true })
  sellerSnapshot: LeadPartySnapshot;

  @Prop({ trim: true, maxlength: 1000 })
  message?: string;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.New })
  status: LeadStatus;

  @Prop({ trim: true, maxlength: 1000 })
  sellerNote?: string;

  @Prop({ required: true })
  lastContactAt: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ listing: 1, buyer: 1 }, { unique: true });
LeadSchema.index({ seller: 1, lastContactAt: -1, _id: -1 });
LeadSchema.index({ seller: 1, status: 1, lastContactAt: -1, _id: -1 });
LeadSchema.index({ buyer: 1, lastContactAt: -1, _id: -1 });
