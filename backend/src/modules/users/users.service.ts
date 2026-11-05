import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { InjectConfig } from '../../config/config.module';
import { AppConfig } from '../../config/app-config';
import { Events, SellerProfileChangedEvent, UserSuspendedEvent } from '../../common/events';
import {
  CursorPage,
  keysetSortSpec,
  KeysetSort,
  toCursorPage,
  withCursor,
} from '../../common/pagination/cursor';
import { Role } from '../../common/types/auth';
import { escapeRegex, normalizePhone, slugify } from '../../common/utils/strings';
import { BranchDto, SellerProfileDto, UpdateMeDto } from './dto/user.dto';
import { DealerBranch, SellerProfile, User, UserStatus } from './schemas/user.schema';
import { toUserView, USER_VIEW_PROJECTION, UserLean, UserView } from './users.mapper';

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  sellerProfile?: SellerProfileDto;
}

export interface UserCredentials {
  _id: Types.ObjectId;
  role: Role;
  status: UserStatus;
  passwordHash: string;
}

/** Minimal seller data denormalised onto every listing (avoids N+1 joins in search). */
export interface SellerSnapshotSource {
  _id: Types.ObjectId;
  name: string;
  status: UserStatus;
  role: Role;
  sellerProfile?: SellerProfile;
}

const NEWEST: KeysetSort = { field: 'createdAt', direction: -1 };
const MAX_BRANCHES = 50;
const FIRST_BRANCH_NAME = 'Main branch';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConfig() private readonly config: AppConfig,
    private readonly events: EventEmitter2,
  ) {}

  normalizePhoneOrThrow(phone: string): string {
    const normalized = normalizePhone(phone, this.config.defaultPhoneRegion);
    if (!normalized) throw new BadRequestException('phone must be a valid phone number');
    return normalized;
  }

  async create(input: CreateUserInput): Promise<UserView> {
    const doc = await this.users.create({
      name: input.name,
      email: input.email,
      phone: this.normalizePhoneOrThrow(input.phone),
      passwordHash: input.passwordHash,
      role: input.role,
      sellerProfile: input.sellerProfile ? this.buildSellerProfile(input.sellerProfile) : undefined,
    });
    return toUserView(doc.toObject());
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.users
      .findOne({ email: email.trim().toLowerCase() }, { role: 1, status: 1, passwordHash: 1 })
      .select('+passwordHash')
      .lean<UserCredentials>()
      .exec();
  }

  findCredentialsById(id: Types.ObjectId): Promise<UserCredentials | null> {
    return this.users
      .findById(id, { role: 1, status: 1, passwordHash: 1 })
      .select('+passwordHash')
      .lean<UserCredentials>()
      .exec();
  }

  async getView(id: Types.ObjectId | string): Promise<UserView> {
    const user = await this.users.findById(id, USER_VIEW_PROJECTION).lean<UserLean>().exec();
    if (!user) throw new NotFoundException('User not found');
    return toUserView(user);
  }

  findSnapshotSource(id: Types.ObjectId): Promise<SellerSnapshotSource | null> {
    return this.users
      .findById(id, { name: 1, status: 1, role: 1, sellerProfile: 1 })
      .lean<SellerSnapshotSource>()
      .exec();
  }

  findContact(id: Types.ObjectId) {
    return this.users
      .findById(id, { name: 1, phone: 1, email: 1, status: 1, sellerProfile: 1 })
      .lean<
        Pick<User, 'name' | 'phone' | 'email' | 'status' | 'sellerProfile'> & {
          _id: Types.ObjectId;
        }
      >()
      .exec();
  }

  /** A suspended account's access token keeps working until it expires, so check before writes. */
  async assertActive(id: Types.ObjectId): Promise<void> {
    if (!(await this.users.exists({ _id: id, status: UserStatus.Active }))) {
      throw new ForbiddenException('Account is suspended');
    }
  }

  touchLastLogin(id: Types.ObjectId): void {
    // Fire-and-forget: login latency should not wait on a bookkeeping write.
    this.users
      .updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } })
      .exec()
      .catch((err: Error) => this.logger.warn(`lastLoginAt update failed: ${err.message}`));
  }

  async updatePasswordHash(id: Types.ObjectId, passwordHash: string): Promise<void> {
    await this.users.updateOne({ _id: id }, { $set: { passwordHash } }).exec();
  }

  async updateMe(id: Types.ObjectId, dto: UpdateMeDto): Promise<UserView> {
    const $set: Record<string, unknown> = {};
    if (dto.name !== undefined) $set.name = dto.name;
    if (dto.phone !== undefined) $set.phone = this.normalizePhoneOrThrow(dto.phone);

    if (dto.sellerProfile) {
      const current = await this.users
        .findById(id, { sellerProfile: 1 })
        .lean<{ sellerProfile?: SellerProfile }>()
        .exec();
      if (!current) throw new NotFoundException('User not found');
      if (!current.sellerProfile) {
        throw new BadRequestException('Create a dealer profile first');
      }
      $set['sellerProfile.businessName'] = dto.sellerProfile.businessName;
    }

    if (Object.keys($set).length === 0) return this.getView(id);

    const updated = await this.users
      .findByIdAndUpdate(
        id,
        { $set },
        { new: true, runValidators: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (!updated) throw new NotFoundException('User not found');

    if (updated.sellerProfile && (dto.name !== undefined || dto.sellerProfile)) {
      this.events.emit(Events.SellerProfileChanged, {
        userId: id,
      } satisfies SellerProfileChangedEvent);
    }
    return toUserView(updated);
  }

  // ---- Dealer branches ----

  async addBranch(id: Types.ObjectId, dto: BranchDto): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        {
          _id: id,
          sellerProfile: { $exists: true },
          [`sellerProfile.branches.${MAX_BRANCHES - 1}`]: { $exists: false },
        },
        { $push: { 'sellerProfile.branches': this.buildBranch(dto) } },
        { new: true, runValidators: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (updated) return this.branchesChanged(id, updated);

    const isDealer = await this.users.exists({ _id: id, sellerProfile: { $exists: true } });
    if (!isDealer) throw new BadRequestException('Create a dealer profile first');
    throw new ConflictException(`A dealer can have at most ${MAX_BRANCHES} branches`);
  }

  async updateBranch(
    id: Types.ObjectId,
    branchId: Types.ObjectId,
    dto: BranchDto,
  ): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: id, 'sellerProfile.branches._id': branchId },
        { $set: { 'sellerProfile.branches.$': this.buildBranch(dto, branchId) } },
        { new: true, runValidators: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (!updated) throw new NotFoundException('Branch not found');
    return this.branchesChanged(id, updated);
  }

  /** Removes a branch; callers check that no cars are still there. */
  async removeBranch(id: Types.ObjectId, branchId: Types.ObjectId): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        {
          _id: id,
          'sellerProfile.branches._id': branchId,
          'sellerProfile.branches.1': { $exists: true },
        },
        { $pull: { 'sellerProfile.branches': { _id: branchId } } },
        { new: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (updated) return this.branchesChanged(id, updated);

    const owned = await this.users.exists({ _id: id, 'sellerProfile.branches._id': branchId });
    if (!owned) throw new NotFoundException('Branch not found');
    throw new ConflictException('A dealer needs at least one address');
  }

  /** Awaited, so the dealer's cars already show the new address when the request returns. */
  private async branchesChanged(id: Types.ObjectId, user: UserLean): Promise<UserView> {
    await this.events.emitAsync(Events.SellerProfileChanged, {
      userId: id,
    } satisfies SellerProfileChangedEvent);
    return toUserView(user);
  }

  /** Upgrades a buyer account to a dealer account. */
  async becomeSeller(id: Types.ObjectId, dto: SellerProfileDto): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: id, role: Role.Buyer },
        { $set: { role: Role.Seller, sellerProfile: this.buildSellerProfile(dto) } },
        { new: true, runValidators: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (updated) return toUserView(updated);

    const existing = await this.users.findById(id, { role: 1 }).lean<{ role: Role }>().exec();
    if (!existing) throw new NotFoundException('User not found');
    throw new ConflictException(
      existing.role === Role.Seller ? 'Already a dealer' : 'This account cannot become a dealer',
    );
  }

  // ---- Admin ----

  async listForAdmin(params: {
    role?: Role;
    status?: UserStatus;
    q?: string;
    cursor?: string;
    limit: number;
  }): Promise<CursorPage<UserView>> {
    const filter: FilterQuery<User> = {};
    if (params.role) filter.role = params.role;
    if (params.status) filter.status = params.status;
    if (params.q) {
      const q = escapeRegex(params.q.trim());
      // Anchored, lowercase email prefix can use the email index; name match is a scan
      // bounded by the other predicates (admin-only, low volume).
      filter.$or = [
        { email: { $regex: `^${q.toLowerCase()}` } },
        { name: { $regex: q, $options: 'i' } },
      ];
    }
    const docs = await this.users
      .find(withCursor(filter, NEWEST, params.cursor), USER_VIEW_PROJECTION)
      .sort(keysetSortSpec(NEWEST))
      .limit(params.limit + 1)
      .lean<UserLean[]>()
      .exec();
    return toCursorPage(docs, params.limit, NEWEST, toUserView);
  }

  async setStatus(id: Types.ObjectId, status: UserStatus): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: id, role: { $ne: Role.Admin } },
        { $set: { status } },
        { new: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    if (status === UserStatus.Suspended) {
      await this.events.emitAsync(Events.UserSuspended, {
        userId: id,
      } satisfies UserSuspendedEvent);
    }
    return toUserView(updated);
  }

  async setSellerVerified(id: Types.ObjectId, verified: boolean): Promise<UserView> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: id, sellerProfile: { $exists: true } },
        { $set: { 'sellerProfile.verified': verified } },
        { new: true, projection: USER_VIEW_PROJECTION },
      )
      .lean<UserLean>()
      .exec();
    if (!updated) throw new NotFoundException('Seller not found');
    this.events.emit(Events.SellerProfileChanged, {
      userId: id,
    } satisfies SellerProfileChangedEvent);
    return toUserView(updated);
  }

  countByRole(): Promise<{ _id: Role; count: number }[]> {
    return this.users.aggregate<{ _id: Role; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
  }

  private buildSellerProfile(dto: SellerProfileDto): SellerProfile {
    return {
      businessName: dto.businessName,
      branches: [this.buildBranch({ ...dto.address, name: FIRST_BRANCH_NAME })],
      verified: false,
    };
  }

  private buildBranch(dto: BranchDto, id = new Types.ObjectId()): DealerBranch {
    return {
      _id: id,
      name: dto.name,
      addressLine: dto.addressLine,
      locality: dto.locality || undefined,
      city: dto.city,
      citySlug: slugify(dto.city),
      state: dto.state,
      pincode: dto.pincode,
      phone: dto.phone ? this.normalizePhoneOrThrow(dto.phone) : undefined,
      lat: dto.lat,
      lng: dto.lng,
    };
  }
}
