export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  publicUrl(key: string): string;
}

/** Objects are content-addressed by random keys and never overwritten, so they can be cached forever. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
