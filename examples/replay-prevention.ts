// Replay prevention with InMemoryIdempotencyStore and RedisIdempotencyStore

import {
  createPayhook,
  InMemoryIdempotencyStore,
  RedisIdempotencyStore,
} from 'payhook-ng';

// --- Option 1: In-Memory Store (single server) ---

const payhookMemory = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  idempotencyStore: new InMemoryIdempotencyStore(),
  idempotencyTTL: 600, // 10 minutes
  maxAgeSeconds: 3600,  // Reject events older than 1 hour
});

// --- Option 2: Redis Store (multi-server production) ---

// Works with both `ioredis` and `redis` (node-redis)
// Example with ioredis:
//
// import Redis from 'ioredis';
// const redis = new Redis(process.env.REDIS_URL);
//
// const payhookRedis = createPayhook({
//   paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
//   flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
//   idempotencyStore: new RedisIdempotencyStore(redis, {
//     prefix: 'myapp:webhooks:', // Custom key prefix (default: 'payhook:idempotency:')
//   }),
//   idempotencyTTL: 600,
//   maxAgeSeconds: 3600,
// });

// --- Usage ---

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  const result = await payhookMemory.verify(rawBody, headers);

  if (!result.ok) {
    // result.code can be:
    // - PAYHOOK_REPLAY_ATTACK: duplicate event ID
    // - PAYHOOK_STALE_EVENT: event timestamp too old
    // - PAYHOOK_INVALID_SIGNATURE: signature mismatch
    // - PAYHOOK_MISSING_HEADER: required header missing
    // - PAYHOOK_UNKNOWN_PROVIDER: cannot detect provider
    return new Response(result.message, { status: 400 });
  }

  return new Response('ok');
}
