# payhook-ng

TypeScript-first webhook verification building blocks for **Paystack** and **Flutterwave**.

## Install

```bash
npm i payhook-ng
```

## Features

- Paystack HMAC SHA-512 signature verification
- Flutterwave secret hash verification
- Unified `verify()` with auto-detection of provider
- `createPayhook()` factory for centralized configuration
- Next.js App Router helpers (Paystack + Flutterwave)
- `withPayhook()` Next.js route handler wrapper
- Express middleware
- Replay prevention with idempotency stores (in-memory + Redis)
- Timestamp-based stale event rejection
- Full TypeScript types for webhook payloads

## Quick Start

### Paystack (Next.js App Router)

```ts
import { paystack } from 'payhook-ng';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const result = await paystack.verifyPaystackRequest(req, process.env.PAYSTACK_SECRET_KEY!);

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  // result.payload is the parsed JSON
  console.log(result.payload.event);
  return new Response('ok');
}
```

### Flutterwave (Next.js App Router)

```ts
import { flutterwave } from 'payhook-ng';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const result = await flutterwave.verifyFlutterwaveRequest(req, process.env.FLUTTERWAVE_SECRET_HASH!);

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  console.log(result.payload.event);
  return new Response('ok');
}
```

### Unified API (auto-detects provider)

```ts
import { verify } from 'payhook-ng';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  const result = await verify(rawBody, headers, {
    paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
    flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
  });

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  console.log(result.provider); // 'paystack' | 'flutterwave'
  return new Response('ok');
}
```

### Factory Pattern (`createPayhook`)

```ts
import { createPayhook, InMemoryIdempotencyStore } from 'payhook-ng';

const payhook = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
  idempotencyStore: new InMemoryIdempotencyStore(),
  maxAgeSeconds: 3600,
});

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  const result = await payhook.verify(rawBody, headers);

  if (!result.ok) {
    return new Response(result.message, { status: 400 });
  }

  return new Response('ok');
}
```

### Next.js Wrapper (`withPayhook`)

```ts
import { withPayhook } from 'payhook-ng/nextjs';

export const POST = withPayhook(
  { paystackSecret: process.env.PAYSTACK_SECRET_KEY! },
  async (payload, request) => {
    // payload is already verified and parsed
    console.log(payload.event);
    return new Response('ok');
  }
);
```

### Express Middleware

```ts
import express from 'express';
import { payhookMiddleware } from 'payhook-ng/express';

const app = express();

app.post(
  '/webhooks',
  express.raw({ type: 'application/json' }),
  payhookMiddleware({
    paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
    flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
  }),
  (req, res) => {
    const payload = req.webhook; // Verified payload
    res.sendStatus(200);
  }
);
```

## Replay Prevention

### In-Memory Store

Suitable for single-server deployments:

```ts
import { createPayhook, InMemoryIdempotencyStore } from 'payhook-ng';

const payhook = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  idempotencyStore: new InMemoryIdempotencyStore(),
  idempotencyTTL: 600, // 10 minutes (default)
});
```

### Redis Store

For multi-server / production deployments:

```ts
import { createPayhook, RedisIdempotencyStore } from 'payhook-ng';
import Redis from 'ioredis';

const redis = new Redis();

const payhook = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  idempotencyStore: new RedisIdempotencyStore(redis),
  idempotencyTTL: 600,
});
```

The `RedisIdempotencyStore` accepts any client that implements `get(key)` and `set(key, value, ...args)` - compatible with both `ioredis` and `redis` (node-redis).

### Stale Event Rejection

Reject events older than a threshold:

```ts
const payhook = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  maxAgeSeconds: 3600, // Reject events older than 1 hour
});
```

## Subpath Imports

```ts
import { ... } from 'payhook-ng';            // Unified API, types, errors, stores
import { ... } from 'payhook-ng/paystack';    // Paystack-specific
import { ... } from 'payhook-ng/flutterwave'; // Flutterwave-specific
import { ... } from 'payhook-ng/nextjs';      // Next.js wrapper
import { ... } from 'payhook-ng/express';     // Express middleware
```

## Security Best Practices

1. **Always use HTTPS** for your webhook endpoints.
2. **Always verify signatures** before processing webhook payloads. Never trust unverified payloads.
3. **Enable replay prevention** using an idempotency store. Use `RedisIdempotencyStore` in production for multi-server setups.
4. **Set `maxAgeSeconds`** to reject stale events that may be replayed.
5. **Use `express.raw()`** with Express to ensure you get the raw body bytes for signature verification. Parsing the body first will invalidate the signature.
6. **Store secrets securely** using environment variables. Never hardcode them.

## Errors

All errors extend `PayhookError` with a typed `code` property:

| Code | Description |
|------|-------------|
| `PAYHOOK_MISSING_HEADER` | Required signature header is missing |
| `PAYHOOK_INVALID_SIGNATURE` | Signature verification failed |
| `PAYHOOK_INVALID_JSON` | Request body is not valid JSON |
| `PAYHOOK_REPLAY_ATTACK` | Duplicate event ID detected |
| `PAYHOOK_STALE_EVENT` | Event timestamp exceeds `maxAgeSeconds` |

```ts
import { InvalidSignatureError, MissingHeaderError } from 'payhook-ng';
```

## License

[MIT](LICENSE)
