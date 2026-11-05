import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * One row per issued refresh token. Tokens are rotated on every use; all tokens
 * descending from one login share a `family` so reuse of a rotated token can
 * revoke the whole chain (stolen-token detection).
 */
@Schema({ collection: 'refresh_sessions', timestamps: { createdAt: true, updatedAt: false } })
export class RefreshSession {
  _id: Types.ObjectId;
  createdAt: Date;

  @Prop({ type: Types.ObjectId, required: true })
  user: Types.ObjectId;

  /** SHA-256 of the token; the raw token is never stored. */
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  family: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ maxlength: 512 })
  userAgent?: string;

  @Prop({ maxlength: 64 })
  ip?: string;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
RefreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
RefreshSessionSchema.index({ user: 1, revokedAt: 1 });
RefreshSessionSchema.index({ family: 1 });
// MongoDB removes expired sessions automatically.
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
