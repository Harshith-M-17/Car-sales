import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** The current password reset link for a user. A new request replaces the previous link. */
@Schema({ collection: 'password_resets' })
export class PasswordReset {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  user: Types.ObjectId;

  /** SHA-256 of the token; the raw token only ever exists in the email. */
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true })
  sentAt: Date;

  /** Emails sent since this row was created, which limits how often a mailbox can be spammed. */
  @Prop({ required: true, default: 0 })
  sendCount: number;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);
// Also what makes sending race-free: a concurrent or rate-limited upsert fails on this index.
PasswordResetSchema.index({ user: 1 }, { unique: true });
PasswordResetSchema.index({ tokenHash: 1 }, { unique: true });
// MongoDB removes expired links automatically, which also clears the send count.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
