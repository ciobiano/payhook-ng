/**
 * Interface for an idempotency store to prevent replay attacks.
 *
 * This allows users to plug in Redis, Memcached, or other storage solutions.
 */
export interface IdempotencyStore {
  /**
   * Checks if a key exists in the store.
   * @param key The unique event ID/reference.
   */
  exists(key: string): Promise<boolean> | boolean;

  /**
   * Marks a key as processed with a Time-To-Live (TTL).
   * @param key The unique event ID/reference.
   * @param ttlSeconds Number of seconds before the key expires.
   */
  record(key: string, ttlSeconds: number): Promise<void> | void;
}
