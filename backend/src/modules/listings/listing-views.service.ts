import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { MemoryStore } from '../../infra/cache/memory-store';
import { REDIS, RedisClient } from '../../infra/redis/redis.constants';
import { Listing } from './schemas/listing.schema';

const DEDUPE_TTL_SECONDS = 6 * 60 * 60;
const PENDING_KEY = 'cs:views:pending';

// SET NX for de-duplication + HINCRBY in one round-trip.
const RECORD_SCRIPT = `
if redis.call("set", KEYS[1], "1", "EX", ARGV[2], "NX") then
  return redis.call("hincrby", KEYS[2], ARGV[1], 1)
end
return 0`;

/**
 * Counts unique listing views without a database write per page view.
 * Views are de-duplicated per viewer for 6h, buffered (Redis hash or memory) and
 * flushed every 30s as one bulkWrite.
 */
@Injectable()
export class ListingViewsService implements OnApplicationShutdown {
  private readonly logger = new Logger(ListingViewsService.name);
  private readonly pending = new Map<string, number>();
  private readonly seen = new MemoryStore(100_000);

  constructor(
    @Inject(REDIS) private readonly redis: RedisClient,
    @InjectModel(Listing.name) private readonly listings: Model<Listing>,
  ) {}

  static viewerKey(
    userId: string | undefined,
    ip: string | undefined,
    userAgent: string | undefined,
  ): string {
    if (userId) return `u:${userId}`;
    return `a:${createHash('sha1')
      .update(`${ip ?? ''}|${userAgent ?? ''}`)
      .digest('base64url')
      .slice(0, 16)}`;
  }

  /** Fire-and-forget; never delays or fails the request. */
  record(listingId: string, viewerKey: string): void {
    const dedupeKey = `cs:view:${listingId}:${viewerKey}`;
    if (!this.redis) {
      if (this.seen.setIfAbsent(dedupeKey, '1', DEDUPE_TTL_SECONDS)) {
        this.pending.set(listingId, (this.pending.get(listingId) ?? 0) + 1);
      }
      return;
    }
    this.redis
      .eval(RECORD_SCRIPT, 2, dedupeKey, PENDING_KEY, listingId, DEDUPE_TTL_SECONDS)
      .catch((err: Error) => this.logger.warn(`view record failed: ${err.message}`));
  }

  @Interval('listing-views-flush', 30_000)
  async flush(): Promise<void> {
    try {
      const counts = this.redis ? await this.drainRedis() : this.drainMemory();
      if (counts.size === 0) return;
      const ops: AnyBulkWriteOperation<Listing>[] = [...counts].map(([id, n]) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $inc: { 'stats.views': n } },
        },
      }));
      await this.listings.bulkWrite(ops, { ordered: false });
    } catch (err) {
      this.logger.warn(`view flush failed: ${(err as Error).message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }

  private drainMemory(): Map<string, number> {
    const snapshot = new Map(this.pending);
    this.pending.clear();
    return snapshot;
  }

  /** RENAME is atomic, so with several API instances each buffered view is flushed exactly once. */
  private async drainRedis(): Promise<Map<string, number>> {
    const redis = this.redis!;
    const flushingKey = `cs:views:flushing:${randomUUID()}`;
    try {
      await redis.rename(PENDING_KEY, flushingKey);
    } catch {
      return new Map(); // nothing pending
    }
    const raw = await redis.hgetall(flushingKey);
    await redis.del(flushingKey);
    return new Map(
      Object.entries(raw)
        .filter(([id]) => /^[a-f\d]{24}$/i.test(id))
        .map(([id, n]) => [id, Number(n)]),
    );
  }
}
