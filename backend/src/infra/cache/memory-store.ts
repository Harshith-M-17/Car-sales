interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * Bounded in-process TTL store used when Redis is not configured.
 * Map iteration order is insertion order, so the first key is the oldest write.
 */
export class MemoryStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 10_000) {}

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** Sets only if absent (or expired). Returns true when the key was written. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): boolean {
    if (this.get(key) !== undefined) return false;
    this.set(key, value, ttlSeconds);
    return true;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
