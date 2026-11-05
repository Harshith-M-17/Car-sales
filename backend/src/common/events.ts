import { Types } from 'mongoose';

/** Domain events used to decouple modules (e.g. users -> listings snapshot sync). */
export const Events = {
  SellerProfileChanged: 'user.seller-profile.changed',
  UserSuspended: 'user.suspended',
  LeadCreated: 'lead.created',
} as const;

export interface SellerProfileChangedEvent {
  userId: Types.ObjectId;
}

export interface UserSuspendedEvent {
  userId: Types.ObjectId;
}

export interface LeadCreatedEvent {
  leadId: Types.ObjectId;
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  buyerId: Types.ObjectId;
}
