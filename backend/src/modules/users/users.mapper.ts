import { Types } from 'mongoose';
import { DealerBranch, User } from './schemas/user.schema';

/** What anyone can see. Phone numbers stay out: buyers get them by sending an inquiry. */
export interface PublicBranchView {
  id: string;
  name: string;
  addressLine: string;
  locality: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface BranchView extends PublicBranchView {
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SellerProfileView {
  businessName: string;
  branches: BranchView[];
  verified: boolean;
}

export interface UserView {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: User['role'];
  status: User['status'];
  sellerProfile: SellerProfileView | null;
  createdAt: Date;
}

export type UserLean = Pick<
  User,
  'name' | 'email' | 'phone' | 'role' | 'status' | 'sellerProfile' | 'createdAt'
> & { _id: Types.ObjectId };

/** Fields needed to build a UserView — used as a projection so we never load passwordHash. */
export const USER_VIEW_PROJECTION = {
  name: 1,
  email: 1,
  phone: 1,
  role: 1,
  status: 1,
  sellerProfile: 1,
  createdAt: 1,
} as const;

export function toPublicBranch(branch: DealerBranch): PublicBranchView {
  return {
    id: branch._id.toString(),
    name: branch.name,
    addressLine: branch.addressLine,
    locality: branch.locality ?? null,
    city: branch.city,
    state: branch.state,
    pincode: branch.pincode,
  };
}

function toBranchView(branch: DealerBranch): BranchView {
  return {
    ...toPublicBranch(branch),
    phone: branch.phone ?? null,
    lat: branch.lat ?? null,
    lng: branch.lng ?? null,
  };
}

export function toUserView(user: UserLean): UserView {
  const sp = user.sellerProfile;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    sellerProfile: sp
      ? {
          businessName: sp.businessName,
          branches: (sp.branches ?? []).map(toBranchView),
          verified: sp.verified,
        }
      : null,
    createdAt: user.createdAt,
  };
}
