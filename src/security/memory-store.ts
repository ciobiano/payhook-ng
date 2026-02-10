import type { IdempotencyStore } from './types.js';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | undefined;

  /**
   * @param gcIntervalSeconds How often to run garbage collection (default: 60s).
   */
  constructor(private gcIntervalSeconds = 60) {
    if (typeof setInterval !== 'undefined') {
      this.timer = setInterval(() => this.cleanup(), gcIntervalSeconds * 1000);
      this.timer.unref();
    }
  }

  /**
   * Atomically checks and records a key. Returns true if this is the first
   * time we've seen it (within TTL), false if it's a duplicate.
   *
   * Because JavaScript is single-threaded, a synchronous check-then-set on
   * a Map is inherently atomic — no other code can interleave between
   * the get and the set. This wouldn't be true in a multi-threaded language.
   */
  recordIfAbsent(key: string, ttlSeconds: number): boolean {
    const existing = this.store.get(key);

    if (existing !== undefined && Date.now() <= existing) {
      return false; // duplicate — key exists and hasn't expired
    }

    this.store.set(key, Date.now() + ttlSeconds * 1000);
    return true; // newly recorded
  }

  /** Stop the garbage collection timer and clear all stored keys. */
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.store.clear();
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
