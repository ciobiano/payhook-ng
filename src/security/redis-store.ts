import type { IdempotencyStore } from './types.js';


export interface RedisLike {
 
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
