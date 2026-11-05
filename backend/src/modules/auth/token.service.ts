import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../../config/app-config';
import { InjectConfig } from '../../config/config.module';
import { AuthUser, Role } from '../../common/types/auth';
import { RefreshSession } from './schemas/refresh-session.schema';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export function clientMeta(req: Request): ClientMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

interface AccessPayload {
  sub: string;
  role: Role;
}

/**
 * A rotated token presented again within this window is treated as a benign race
 * (two tabs refreshing at once) rather than theft.
 */
const REUSE_GRACE_MS = 20_000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @InjectModel(RefreshSession.name) private readonly sessions: Model<RefreshSession>,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  get accessTtlSeconds() {
    return this.config.auth.accessTtlSeconds;
  }

  get refreshTtlMs() {
    return this.config.auth.refreshTtlDays * 86_400_000;
  }

  signAccess(user: AuthUser): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role } satisfies AccessPayload, {
      expiresIn: this.config.auth.accessTtlSeconds,
    });
  }

  async verifyAccess(token: string): Promise<AuthUser> {
    const payload = await this.jwt.verifyAsync<AccessPayload>(token);
    if (typeof payload.sub !== 'string' || !Object.values(Role).includes(payload.role)) {
      throw new UnauthorizedException('Invalid token');
    }
    return { id: payload.sub, role: payload.role };
  }

  async issueRefresh(
    userId: Types.ObjectId,
    meta: ClientMeta,
    family: string = randomUUID(),
  ): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.sessions.create({
      user: userId,
      tokenHash: hashToken(token),
      family,
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
      userAgent: meta.userAgent?.slice(0, 512),
      ip: meta.ip?.slice(0, 64),
    });
    return token;
  }

  /**
   * Atomically consumes a refresh token and issues its successor.
   * Throws 401 for unknown, expired or replayed tokens; replay outside the grace
   * window revokes every session in the family.
   */
  async rotate(
    token: string,
    meta: ClientMeta,
  ): Promise<{ userId: Types.ObjectId; refreshToken: string }> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const consumed = await this.sessions
      .findOneAndUpdate(
        { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now } },
        { projection: { user: 1, family: 1 } },
      )
      .lean()
      .exec();

    if (consumed) {
      const refreshToken = await this.issueRefresh(consumed.user, meta, consumed.family);
      return { userId: consumed.user, refreshToken };
    }

    const existing = await this.sessions
      .findOne({ tokenHash }, { user: 1, family: 1, revokedAt: 1, expiresAt: 1 })
      .lean()
      .exec();

    if (existing?.revokedAt && existing.expiresAt > now) {
      const familyAlive = await this.sessions.exists({ family: existing.family, revokedAt: null });
      if (familyAlive && now.getTime() - existing.revokedAt.getTime() < REUSE_GRACE_MS) {
        const refreshToken = await this.issueRefresh(existing.user, meta, existing.family);
        return { userId: existing.user, refreshToken };
      }
      await this.revokeFamily(existing.family);
    }
    throw new UnauthorizedException('Session expired, please sign in again');
  }

  /** Who a refresh token belongs to, if it's still live. Unlike rotate(), this doesn't use it up. */
  async liveSessionUser(token: string): Promise<Types.ObjectId | null> {
    const session = await this.sessions
      .findOne(
        { tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } },
        { user: 1 },
      )
      .lean()
      .exec();
    return session?.user ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.sessions
      .updateOne(
        { tokenHash: hashToken(token), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeFamilyOf(token: string): Promise<void> {
    const session = await this.sessions
      .findOne({ tokenHash: hashToken(token) }, { family: 1 })
      .lean()
      .exec();
    if (session) await this.revokeFamily(session.family);
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.sessions
      .updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.sessions
      .updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }
}
