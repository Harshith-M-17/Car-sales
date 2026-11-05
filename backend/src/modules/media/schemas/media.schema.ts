import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum MediaStatus {
  /** Uploaded but not yet attached to a listing; garbage-collected after a grace period. */
  Pending = 'pending',
  Attached = 'attached',
}

@Schema({ collection: 'media', timestamps: true })
export class Media {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, required: true })
  owner: Types.ObjectId;

  @Prop({ required: true })
  largeKey: string;

  @Prop({ required: true })
  thumbKey: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  thumbUrl: string;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  @Prop({ required: true })
  bytes: number;

  @Prop({ type: String, enum: MediaStatus, default: MediaStatus.Pending })
  status: MediaStatus;

  @Prop({ type: Types.ObjectId, default: null })
  listing: Types.ObjectId | null;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
MediaSchema.index({ owner: 1, createdAt: -1 });
MediaSchema.index({ listing: 1 });
// Orphan cleanup scans pending media by age (status changes bump updatedAt).
MediaSchema.index({ status: 1, updatedAt: 1 });
