import type { IdempotencyStore } from './types.js';

/**
 * Minimal Redis client interface satisfied by both `ioredis` and `redis` (node-redis v4+).
 *
 * We use SET with NX+EX for atomic "record if absent with TTL". Both client
 * libraries support this calling convention through their .set() method.
 */
export interface RedisLike {
  /**
   * SET key value [EX seconds] [NX]
   *
   * - ioredis:      set(key, value, 'EX', ttl, 'NX') → Promise<'OK' | null>
   * - node-redis:   set(key, value, { EX: ttl, NX: true }) → Promise<string | null>
   *
   * Both return null when the key already exists (NX fails).
   */
  set(key: string, value: string, ...args: any[]): Promise<any>;
}

export class RedisIdempotencyStore implements IdempotencyStore {
  private prefix: string;

  constructor(
    private client: RedisLike,
    private options: { prefix?: string; clientType?: 'ioredis' | 'node-redis' } = {}
  ) {
    this.prefix = options.prefix ?? 'payhook:idempotency:';
  }

  /**
   * Atomically records a key in Redis using SET ... NX EX.
   *
   * NX = "only set if Not eXists" — this is atomic at the Redis server level.
   * If two requests race, only one gets 'OK'; the other gets null.
   * No TOCTOU race condition possible.
   *
   * Returns true if key was newly set, false if it already existed.
   */
  async recordIfAbsent(key: string, ttlSeconds: number): Promise<boolean> {
    const fullKey = this.prefix + key;

    let result: any;
    if (this.options.clientType === 'node-redis') {
      // node-redis v4+ uses an options object
      result = await this.client.set(fullKey, '1', { EX: ttlSeconds, NX: true } as any);
    } else {
      // ioredis (default) uses positional arguments
      result = await this.client.set(fullKey, '1', 'EX', ttlSeconds, 'NX');
    }

    // Both clients return null when NX condition fails (key already exists)
    return result !== null;
  }
}
