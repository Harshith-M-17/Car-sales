import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import { Events, UserSuspendedEvent } from '../../common/events';
import { Role } from '../../common/types/auth';
import { SellerProfileDto } from '../users/dto/user.dto';
import { UserStatus } from '../users/schemas/user.schema';
import { UserView } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { PasswordResetService } from './password-reset.service';
import { ClientMeta, TokenService } from './token.service';

export interface AuthResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: UserView;
}

// OWASP-recommended argon2id baseline (19 MiB, t=2, p=1): ~20-40ms per hash.
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown so response time doesn't reveal account existence. */
  private dummyHash = '';

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly resets: PasswordResetService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('not-a-real-password-0', ARGON_OPTIONS);
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthResult> {
    const isSeller = dto.accountType === 'seller';
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash: await this.hashPassword(dto.password),
      role: isSeller ? Role.Seller : Role.Buyer,
      sellerProfile: isSeller ? dto.sellerProfile : undefined,
    });
    return this.issue(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthResult> {
    const creds = await this.users.findCredentialsByEmail(dto.email);
    const valid = await argon2.verify(creds?.passwordHash ?? this.dummyHash, dto.password);
    if (!creds || !valid) throw new UnauthorizedException('Invalid email or password');
    if (creds.status !== UserStatus.Active) throw new ForbiddenException('Account is suspended');

    this.users.touchLastLogin(creds._id);
    return this.issue(await this.users.getView(creds._id), meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResult> {
    const { userId, refreshToken: next } = await this.tokens.rotate(refreshToken, meta);
    const user = await this.users.getView(userId).catch(() => null);
    if (!user || user.status !== UserStatus.Active) {
      await this.tokens.revokeAllForUser(userId);
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    return {
      accessToken: await this.tokens.signAccess({ id: user.id, role: user.role }),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshToken: next,
      user,
    };
  }

  /** Confirms a saved login is still good, so signed-out or suspended accounts drop on page load. */
  async currentUser(refreshToken: string): Promise<UserView> {
    const userId = await this.tokens.liveSessionUser(refreshToken);
    const user = userId && (await this.users.getView(userId).catch(() => null));
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    return user;
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revokeFamilyOf(refreshToken);
  }

  logoutAll(userId: Types.ObjectId): Promise<void> {
    return this.tokens.revokeAllForUser(userId);
  }

  /** Changes the password, signs out every other device and returns a fresh session. */
  async changePassword(
    userId: Types.ObjectId,
    dto: ChangePasswordDto,
    meta: ClientMeta,
  ): Promise<AuthResult> {
    const creds = await this.users.findCredentialsById(userId);
    if (!creds || !(await argon2.verify(creds.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.users.updatePasswordHash(userId, await this.hashPassword(dto.newPassword));
    await this.tokens.revokeAllForUser(userId);
    await this.resets.cancel(userId);
    return this.issue(await this.users.getView(userId), meta);
  }

  /**
   * Returns before looking anything up, so neither the response nor its timing reveals
   * whether the email has an account. Failures can only be logged.
   */
  requestPasswordReset(email: string): void {
    this.sendResetLink(email).catch((err: Error) =>
      this.logger.error(`Password reset email failed: ${err.message}`),
    );
  }

  private async sendResetLink(email: string): Promise<void> {
    const creds = await this.users.findCredentialsByEmail(email);
    if (!creds || creds.status !== UserStatus.Active) return;
    // Emails aren't verified, so an admin's address may belong to someone else, and whoever
    // reads it would control the whole platform. Admins must keep their password.
    if (creds.role === Role.Admin) return;
    await this.resets.sendLink(creds._id, email.toLowerCase());
  }

  async resetPassword(dto: ResetPasswordDto, meta: ClientMeta): Promise<AuthResult> {
    const userId = await this.resets.consume(dto.token);
    const creds = userId && (await this.users.findCredentialsById(userId));
    if (!creds || creds.status !== UserStatus.Active) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }
    await this.users.updatePasswordHash(creds._id, await this.hashPassword(dto.newPassword));
    await this.tokens.revokeAllForUser(creds._id);
    this.users.touchLastLogin(creds._id);
    return this.issue(await this.users.getView(creds._id), meta);
  }

  /** Buyer -> seller upgrade. Returns a new access token carrying the seller role. */
  async becomeSeller(userId: Types.ObjectId, dto: SellerProfileDto) {
    const user = await this.users.becomeSeller(userId, dto);
    return {
      accessToken: await this.tokens.signAccess({ id: user.id, role: user.role }),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      user,
    };
  }

  /** Suspended users lose every session; their access token dies within its short TTL. */
  @OnEvent(Events.UserSuspended, { promisify: true, suppressErrors: false })
  async onUserSuspended(event: UserSuspendedEvent): Promise<void> {
    await this.tokens.revokeAllForUser(event.userId);
  }

  private async issue(user: UserView, meta: ClientMeta): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess({ id: user.id, role: user.role }),
      this.tokens.issueRefresh(new Types.ObjectId(user.id), meta),
    ]);
    return { accessToken, accessTokenExpiresIn: this.tokens.accessTtlSeconds, refreshToken, user };
  }
}
