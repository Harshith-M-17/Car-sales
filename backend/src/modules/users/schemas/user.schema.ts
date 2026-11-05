import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../../common/types/auth';

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
}

/** A dealership location. The first one is the dealer's main address. */
@Schema()
export class DealerBranch {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  addressLine: string;

  @Prop({ trim: true, maxlength: 120 })
  locality?: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  city: string;

  @Prop({ required: true })
  citySlug: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  state: string;

  @Prop({ required: true, trim: true, maxlength: 10 })
  pincode: string;

  /** E.164. Buyers get this number for cars at this branch; without it, the dealer's own. */
  @Prop()
  phone?: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;
}
const DealerBranchSchema = SchemaFactory.createForClass(DealerBranch);

/** Every seller is a dealer. Branches are few, so they live on the user and sign-up stays atomic. */
@Schema({ _id: false })
export class SellerProfile {
  @Prop({ required: true, trim: true, maxlength: 120 })
  businessName: string;

  @Prop({ type: [DealerBranchSchema], default: [] })
  branches: DealerBranch[];

  @Prop({ default: false })
  verified: boolean;
}
export const SellerProfileSchema = SchemaFactory.createForClass(SellerProfile);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, maxlength: 254 })
  email: string;

  /** E.164 formatted. */
  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: Role, default: Role.Buyer })
  role: Role;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.Active })
  status: UserStatus;

  @Prop({ type: SellerProfileSchema })
  sellerProfile?: SellerProfile;

  @Prop()
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 }, { unique: true });
// Admin user lists (filter by role, newest first, keyset on createdAt/_id).
UserSchema.index({ role: 1, createdAt: -1, _id: -1 });
UserSchema.index({ createdAt: -1, _id: -1 });
