import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verify, createPayhook } from './index.js';
import { InMemoryIdempotencyStore } from './security/memory-store.js';

const PAYSTACK_SECRET = 'sk_test_abc123';
const FLUTTERWAVE_HASH = 'my-flutterwave-secret-hash';

/** Helper: sign a body with Paystack's HMAC-SHA512 */
function paystackSign(body: string, secret = PAYSTACK_SECRET): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

function makePaystackHeaders(body: string, secret = PAYSTACK_SECRET) {
  return { 'x-paystack-signature': paystackSign(body, secret) };
}

function makeFlutterwaveHeaders(hash = FLUTTERWAVE_HASH) {
  return { 'verif-hash': hash };
}

const PAYSTACK_BODY = JSON.stringify({
  event: 'charge.success',
  data: {
    id: 12345,
    reference: 'ref_abc',
    amount: 50000,
    currency: 'NGN',
    created_at: new Date().toISOString(), // fresh timestamp
  },
});

const FLUTTERWAVE_BODY = JSON.stringify({
  event: 'charge.completed',
  data: {
    id: 67890,
    tx_ref: 'tx_abc',
    amount: 10000,
    currency: 'NGN',
    created_at: new Date().toISOString(),
  },
});

describe('verify() — provider detection', () => {
  it('detects Paystack from x-paystack-signature header', async () => {
    const result = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('paystack');
    }
  });

  it('detects Flutterwave from verif-hash header', async () => {
    const result = await verify(FLUTTERWAVE_BODY, makeFlutterwaveHeaders(), {
      flutterwaveSecretHash: FLUTTERWAVE_HASH,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('flutterwave');
    }
  });

  it('returns PAYHOOK_UNKNOWN_PROVIDER when no matching headers', async () => {
    const result = await verify('{}', { 'x-random': 'header' }, {
      paystackSecret: PAYSTACK_SECRET,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_UNKNOWN_PROVIDER');
    }
  });

  it('returns PAYHOOK_UNKNOWN_PROVIDER when header present but no matching secret configured', async () => {
    const result = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      // paystackSecret not provided, only flutterwave
      flutterwaveSecretHash: FLUTTERWAVE_HASH,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_UNKNOWN_PROVIDER');
    }
  });
});

describe('verify() — timestamp validation', () => {
  it('rejects stale events when maxAgeSeconds is set', async () => {
    const staleBody = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 99999,
        reference: 'ref_stale',
        amount: 1000,
        created_at: '2020-01-01T00:00:00.000Z', // very old
      },
    });

    const result = await verify(staleBody, makePaystackHeaders(staleBody), {
      paystackSecret: PAYSTACK_SECRET,
      maxAgeSeconds: 300, // 5 minutes
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_STALE_EVENT');
    }
  });

  it('accepts fresh events when maxAgeSeconds is set', async () => {
    const result = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
      maxAgeSeconds: 300,
    });

    expect(result.ok).toBe(true);
  });
});

describe('verify() — idempotency (replay prevention)', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore(60);
  });

  afterEach(() => {
    store.dispose();
  });

  it('allows first occurrence of an event', async () => {
    const result = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects duplicate event (replay attack)', async () => {
    // First call — succeeds
    await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
    });

    // Second call — same event ID — rejected
    const result = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_REPLAY_ATTACK');
    }
  });

  it('allows different events through', async () => {
    const body2 = JSON.stringify({
      event: 'charge.success',
      data: { id: 99999, reference: 'ref_different', amount: 1000, created_at: new Date().toISOString() },
    });

    const r1 = await verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
    });

    const r2 = await verify(body2, makePaystackHeaders(body2), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it('does NOT record event if timestamp validation fails (correct ordering)', async () => {
    const staleBody = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 77777,
        reference: 'ref_stale_idempotency',
        amount: 5000,
        created_at: '2020-01-01T00:00:00.000Z', // very old
      },
    });

    // First attempt — rejected as stale
    const r1 = await verify(staleBody, makePaystackHeaders(staleBody), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
      maxAgeSeconds: 300,
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('PAYHOOK_STALE_EVENT');

    // Key should NOT be in the idempotency store.
    // If we send a fresh version of the same event ID, it should be accepted.
    const freshBody = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 77777, // same ID
        reference: 'ref_stale_idempotency',
        amount: 5000,
        created_at: new Date().toISOString(), // now fresh
      },
    });

    const r2 = await verify(freshBody, makePaystackHeaders(freshBody), {
      paystackSecret: PAYSTACK_SECRET,
      idempotencyStore: store,
      maxAgeSeconds: 300,
    });

    // This MUST pass. If the old code recorded before timestamp check,
    // this would fail with PAYHOOK_REPLAY_ATTACK instead.
    expect(r2.ok).toBe(true);
  });
});

describe('createPayhook()', () => {
  it('creates a pre-configured verify function', async () => {
    const payhook = createPayhook({
      paystackSecret: PAYSTACK_SECRET,
      flutterwaveSecretHash: FLUTTERWAVE_HASH,
    });

    const result = await payhook.verify(PAYSTACK_BODY, makePaystackHeaders(PAYSTACK_BODY));
    expect(result.ok).toBe(true);
  });
});
