import type { IdempotencyStore } from './types.js';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, number>();

  /**
   * @param gcIntervalSeconds How often to run garbage collection (default: 60s).
   */
  constructor(private gcIntervalSeconds = 60) {
    if (typeof setInterval !== 'undefined') {
        // Simple GC mechanism
        setInterval(() => this.cleanup(), gcIntervalSeconds * 1000).unref();
    }
  }

  exists(key: string): boolean {
    const expiresAt = this.store.get(key);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  record(key: string, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, expiresAt);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, expiresAt] of this.store.entries()) {
      if (now > expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
