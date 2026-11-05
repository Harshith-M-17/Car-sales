import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { IMMUTABLE_CACHE_CONTROL, StorageDriver } from './storage.driver';

export interface S3DriverOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** CDN or bucket public URL, e.g. https://cdn.example.com */
  publicBaseUrl: string;
}

/** Works with AWS S3 and S3-compatible stores (Cloudflare R2, DigitalOcean Spaces, MinIO). */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly options: S3DriverOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: Boolean(options.endpoint),
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined, // fall back to the default provider chain (IAM role, env, profile)
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
    );
  }

  async delete(keys: string[]): Promise<void> {
    // DeleteObjects accepts at most 1000 keys per call.
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.options.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  publicUrl(key: string): string {
    return `${this.options.publicBaseUrl}/${key}`;
  }
}
