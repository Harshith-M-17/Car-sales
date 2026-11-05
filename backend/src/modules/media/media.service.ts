import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { mapWithConcurrency } from '../../common/utils/concurrency';
import { DistributedLockService } from '../../infra/redis/distributed-lock.service';
import { ImageProcessor } from './image-processor';
import { Media, MediaStatus } from './schemas/media.schema';
import { STORAGE_DRIVER, StorageDriver } from './storage/storage.driver';

export interface MediaView {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** Image as embedded on a listing document. */
export interface EmbeddedImage {
  mediaId: Types.ObjectId;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 500;
const IMAGE_PROJECTION = { url: 1, thumbUrl: 1, width: 1, height: 1, listing: 1 } as const;

type MediaLean = Pick<Media, 'url' | 'thumbUrl' | 'width' | 'height' | 'listing'> & {
  _id: Types.ObjectId;
};

const toView = (m: MediaLean): MediaView => ({
  id: m._id.toString(),
  url: m.url,
  thumbUrl: m.thumbUrl,
  width: m.width,
  height: m.height,
});

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private readonly media: Model<Media>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly processor: ImageProcessor,
    private readonly locks: DistributedLockService,
  ) {}

  async uploadImages(ownerId: Types.ObjectId, files: Express.Multer.File[]): Promise<MediaView[]> {
    if (!files?.length) throw new BadRequestException('No files uploaded');

    // Process everything before writing anything, so one bad file doesn't leave partial uploads.
    const processed = await mapWithConcurrency(files, 2, (f) => this.processor.process(f.buffer));

    const now = new Date();
    const prefix = `listings/${ownerId.toString()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const records = processed.map((img) => {
      const id = randomBytes(12).toString('hex');
      return { img, largeKey: `${prefix}/${id}-lg.webp`, thumbKey: `${prefix}/${id}-th.webp` };
    });

    const written: string[] = [];
    try {
      await mapWithConcurrency(records, 4, async (r) => {
        await this.storage.put(r.largeKey, r.img.large, 'image/webp');
        written.push(r.largeKey);
        await this.storage.put(r.thumbKey, r.img.thumb, 'image/webp');
        written.push(r.thumbKey);
      });
    } catch (err) {
      await this.storage.delete(written).catch(() => undefined);
      throw err;
    }

    const docs = await this.media.insertMany(
      records.map((r) => ({
        owner: ownerId,
        largeKey: r.largeKey,
        thumbKey: r.thumbKey,
        url: this.storage.publicUrl(r.largeKey),
        thumbUrl: this.storage.publicUrl(r.thumbKey),
        width: r.img.width,
        height: r.img.height,
        bytes: r.img.large.length + r.img.thumb.length,
        status: MediaStatus.Pending,
      })),
    );
    return docs.map((d) => toView(d));
  }

  /**
   * Attaches uploaded media to a listing in two queries total (one read, one write),
   * preserving the caller's order. Only the owner's unattached (or already-attached-here)
   * media is accepted.
   */
  async attach(
    ownerId: Types.ObjectId,
    mediaIds: string[],
    listingId: Types.ObjectId,
  ): Promise<EmbeddedImage[]> {
    const ids = [...new Set(mediaIds)].map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return [];

    const docs = await this.media
      .find(
        { _id: { $in: ids }, owner: ownerId, $or: [{ listing: null }, { listing: listingId }] },
        IMAGE_PROJECTION,
      )
      .lean<MediaLean[]>()
      .exec();
    if (docs.length !== ids.length) throw new BadRequestException('One or more images are invalid');

    await this.media
      .updateMany(
        { _id: { $in: ids } },
        { $set: { status: MediaStatus.Attached, listing: listingId } },
      )
      .exec();

    const byId = new Map(docs.map((d) => [d._id.toString(), d]));
    return ids.map((id) => {
      const m = byId.get(id.toString())!;
      return { mediaId: m._id, url: m.url, thumbUrl: m.thumbUrl, width: m.width, height: m.height };
    });
  }

  /** Detaches media no longer used by a listing; they become eligible for cleanup. */
  async detachExcept(listingId: Types.ObjectId, keep: Types.ObjectId[]): Promise<void> {
    await this.media
      .updateMany(
        { listing: listingId, _id: { $nin: keep } },
        { $set: { status: MediaStatus.Pending, listing: null } },
      )
      .exec();
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'media-orphan-cleanup' })
  async cleanupOrphans(): Promise<void> {
    await this.locks.runExclusive('media-orphan-cleanup', 10 * 60_000, async () => {
      const cutoff = new Date(Date.now() - ORPHAN_GRACE_MS);
      let removed = 0;
      for (let batch = 0; batch < 20; batch++) {
        const orphans = await this.media
          .find(
            { status: MediaStatus.Pending, updatedAt: { $lt: cutoff } },
            { largeKey: 1, thumbKey: 1 },
          )
          .limit(CLEANUP_BATCH)
          .lean()
          .exec();
        if (orphans.length === 0) break;
        await this.storage.delete(orphans.flatMap((o) => [o.largeKey, o.thumbKey]));
        await this.media
          .deleteMany({ _id: { $in: orphans.map((o) => o._id) }, status: MediaStatus.Pending })
          .exec();
        removed += orphans.length;
        if (orphans.length < CLEANUP_BATCH) break;
      }
      if (removed) this.logger.log(`Removed ${removed} orphaned images`);
    });
  }
}
