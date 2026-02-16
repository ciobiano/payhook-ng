/**
 * Interface for an idempotency store to prevent replay attacks.
 *
 * This allows users to plug in Redis, Memcached, or other storage solutions.
 *
 * 
 */
export interface IdempotencyStore {
 
   
  recordIfAbsent(key: string, ttlSeconds: number): Promise<boolean> | boolean;
}
