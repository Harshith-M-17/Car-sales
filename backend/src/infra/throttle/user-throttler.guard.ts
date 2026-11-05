import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const INTERNAL_KEY_HEADER = 'x-internal-key';

/** True for our own website server, which renders pages for every visitor from one IP. */
export function isInternalRequest(req: Request, key: string | null): boolean {
  const sent = req.headers[INTERNAL_KEY_HEADER];
  if (!key || typeof sent !== 'string') return false;
  const [a, b] = [Buffer.from(sent), Buffer.from(key)];
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rate-limits signed-in users by account (so a shared office/NAT IP isn't penalised)
 * and anonymous traffic by IP. Runs after JwtAuthGuard so `req.user` is populated.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const r = req as Request;
    return r.user ? `u:${r.user.id}` : `ip:${r.ip ?? 'unknown'}`;
  }
}
