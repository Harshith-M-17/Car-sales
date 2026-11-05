import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ collection: 'favorites', timestamps: { createdAt: true, updatedAt: false } })
export class Favorite {
  _id: Types.ObjectId;
  createdAt: Date;

  @Prop({ type: Types.ObjectId, required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  listing: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
// Uniqueness + covered "which of these listings has the user saved?" lookups.
FavoriteSchema.index({ user: 1, listing: 1 }, { unique: true });
// "My saved cars", newest first (keyset).
FavoriteSchema.index({ user: 1, createdAt: -1, _id: -1 });
