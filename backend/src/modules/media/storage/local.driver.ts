import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { StorageDriver } from './storage.driver';

/** Development driver: files on local disk, served by the API under /uploads. */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(
    root: string,
    private readonly publicBaseUrl: string,
  ) {
    this.root = resolve(root);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.pathFor(key), { force: true })));
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    // Keys are generated server-side, but never allow escaping the upload root.
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  }
}
