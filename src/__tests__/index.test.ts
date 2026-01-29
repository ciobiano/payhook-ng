import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verify, createPayhook, InMemoryIdempotencyStore } from '../index.js';

const PAYSTACK_SECRET = 'sk_test_abcdef1234567890';
const FLUTTERWAVE_SECRET_HASH = 'flw_secret_hash_test';

function signPaystack(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

const PAYSTACK_PAYLOAD = JSON.stringify({
  event: 'charge.success',
  data: { id: 100, reference: 'ref_abc', amount: 50000, currency: 'NGN' }
});

const FLUTTERWAVE_PAYLOAD = JSON.stringify({
  event: 'charge.completed',
  data: { id: 200, tx_ref: 'tx_ref_abc', amount: 5000, currency: 'NGN' }
});

describe('verify() - unified API', () => {
  it('should auto-detect Paystack from x-paystack-signature header', async () => {
    const sig = signPaystack(PAYSTACK_PAYLOAD, PAYSTACK_SECRET);
    const result = await verify(PAYSTACK_PAYLOAD, {
      'x-paystack-signature': sig,
    }, { paystackSecret: PAYSTACK_SECRET });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('paystack');
      expect(result.payload.event).toBe('charge.success');
    }
  });

  it('should auto-detect Flutterwave from verif-hash header', async () => {
    const result = await verify(FLUTTERWAVE_PAYLOAD, {
      'verif-hash': FLUTTERWAVE_SECRET_HASH,
    }, { flutterwaveSecretHash: FLUTTERWAVE_SECRET_HASH });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('flutterwave');
      expect(result.payload.event).toBe('charge.completed');
    }
  });

  it('should return PAYHOOK_UNKNOWN_PROVIDER when neither header is present', async () => {
    const result = await verify(PAYSTACK_PAYLOAD, {}, {
      paystackSecret: PAYSTACK_SECRET,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_UNKNOWN_PROVIDER');
  });

  it('should detect replay with idempotency store', async () => {
    const store = new InMemoryIdempotencyStore();
    const sig = signPaystack(PAYSTACK_PAYLOAD, PAYSTACK_SECRET);
    const config = { paystackSecret: PAYSTACK_SECRET, idempotencyStore: store };
    const headers = { 'x-paystack-signature': sig };

    // First call should succeed
    const first = await verify(PAYSTACK_PAYLOAD, headers, config);
    expect(first.ok).toBe(true);

    // Second call should detect replay
    const second = await verify(PAYSTACK_PAYLOAD, headers, config);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('PAYHOOK_REPLAY_ATTACK');
  });

  it('should reject stale events when maxAgeSeconds is configured', async () => {
    const oldDate = new Date(Date.now() - 7200 * 1000).toISOString(); // 2 hours ago
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { id: 999, reference: 'ref_old', amount: 1000, created_at: oldDate }
    });
    const sig = signPaystack(payload, PAYSTACK_SECRET);

    const result = await verify(payload, {
      'x-paystack-signature': sig,
    }, { paystackSecret: PAYSTACK_SECRET, maxAgeSeconds: 3600 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_STALE_EVENT');
  });

  it('should allow recent events when maxAgeSeconds is configured', async () => {
    const recentDate = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { id: 998, reference: 'ref_new', amount: 1000, created_at: recentDate }
    });
    const sig = signPaystack(payload, PAYSTACK_SECRET);

    const result = await verify(payload, {
      'x-paystack-signature': sig,
    }, { paystackSecret: PAYSTACK_SECRET, maxAgeSeconds: 3600 });

    expect(result.ok).toBe(true);
  });
});

describe('createPayhook()', () => {
  it('should return an object with a verify method', () => {
    const payhook = createPayhook({ paystackSecret: PAYSTACK_SECRET });
    expect(typeof payhook.verify).toBe('function');
  });

  it('should verify Paystack webhooks via the factory', async () => {
    const payhook = createPayhook({ paystackSecret: PAYSTACK_SECRET });
    const sig = signPaystack(PAYSTACK_PAYLOAD, PAYSTACK_SECRET);

    const result = await payhook.verify(PAYSTACK_PAYLOAD, {
      'x-paystack-signature': sig,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('paystack');
  });

  it('should verify Flutterwave webhooks via the factory', async () => {
    const payhook = createPayhook({ flutterwaveSecretHash: FLUTTERWAVE_SECRET_HASH });

    const result = await payhook.verify(FLUTTERWAVE_PAYLOAD, {
      'verif-hash': FLUTTERWAVE_SECRET_HASH,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('flutterwave');
  });
});
