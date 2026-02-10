/**
 * Interface for an idempotency store to prevent replay attacks.
 *
 * This allows users to plug in Redis, Memcached, or other storage solutions.
 *
 * Why a single `recordIfAbsent` instead of separate `exists` + `record`?
 * Because separate calls have a race condition (TOCTOU — Time Of Check To
 * Time Of Use). Between checking "does this exist?" and recording it, a
 * concurrent request can slip through. A single atomic operation eliminates
 * that window entirely.
 */
export interface IdempotencyStore {
  /**
   * Atomically records a key if it doesn't already exist.
   *
   * @param key The unique event ID/reference.
   * @param ttlSeconds Number of seconds before the key expires.
   * @returns `true` if the key was newly recorded (first time seen),
   *          `false` if it already existed (duplicate/replay).
   */
  recordIfAbsent(key: string, ttlSeconds: number): Promise<boolean> | boolean;
}
