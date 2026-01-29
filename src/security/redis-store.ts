import type { IdempotencyStore } from './types.js';

/**
 * A minimal interface that both `ioredis` and `redis` (node-redis) satisfy.
 * We don't import either library - the user provides their own client.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
}

export class RedisIdempotencyStore implements IdempotencyStore {
  private prefix: string;

  constructor(
    private client: RedisLike,
    options: { prefix?: string } = {}
  ) {
    this.prefix = options.prefix ?? 'payhook:idempotency:';
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.get(this.prefix + key);
    return result !== null;
  }

  async record(key: string, ttlSeconds: number): Promise<void> {
    // SET key value EX ttlSeconds
    await this.client.set(this.prefix + key, '1', 'EX', ttlSeconds);
  }
}
