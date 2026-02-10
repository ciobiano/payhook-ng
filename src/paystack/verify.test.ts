import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  verifyPaystackWebhook,
  verifyPaystackWebhookOrThrow,
  computePaystackSignature,
  PAYSTACK_SIGNATURE_HEADER,
} from './verify.js';
import { MissingHeaderError, InvalidSignatureError, InvalidJsonError } from '../errors.js';

const TEST_SECRET = 'sk_test_abc123';

/** Helper: create a valid signed webhook request */
function createSignedPayload(payload: object, secret = TEST_SECRET) {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return { rawBody, signature };
}

const SAMPLE_PAYLOAD = {
  event: 'charge.success',
  data: {
    id: 12345,
    reference: 'ref_abc',
    amount: 50000,
    currency: 'NGN',
    created_at: '2026-01-15T10:30:00.000Z',
  },
};

describe('verifyPaystackWebhook', () => {
  it('accepts a valid signature', () => {
    const { rawBody, signature } = createSignedPayload(SAMPLE_PAYLOAD);

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      signature,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('paystack');
      expect(result.payload.event).toBe('charge.success');
    }
  });

  it('accepts when signature is in headers map', () => {
    const { rawBody, signature } = createSignedPayload(SAMPLE_PAYLOAD);

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      headers: { [PAYSTACK_SIGNATURE_HEADER]: signature },
    });

    expect(result.ok).toBe(true);
  });

  it('handles case-insensitive header lookup', () => {
    const { rawBody, signature } = createSignedPayload(SAMPLE_PAYLOAD);

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      headers: { 'X-Paystack-Signature': signature },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects when signature header is missing', () => {
    const result = verifyPaystackWebhook({
      rawBody: '{}',
      secret: TEST_SECRET,
      headers: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_MISSING_HEADER');
    }
  });

  it('rejects an invalid signature', () => {
    const result = verifyPaystackWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secret: TEST_SECRET,
      signature: 'deadbeef'.repeat(16), // wrong signature, valid hex, 128 chars = 64 bytes
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
    }
  });

  it('rejects a signature computed with wrong secret', () => {
    const { rawBody } = createSignedPayload(SAMPLE_PAYLOAD);
    const wrongSignature = crypto.createHmac('sha512', 'wrong_secret').update(rawBody).digest('hex');

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      signature: wrongSignature,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
    }
  });

  it('rejects non-hex garbage as signature', () => {
    const result = verifyPaystackWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secret: TEST_SECRET,
      signature: 'not-valid-hex-at-all!!!',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
    }
  });

  it('handles Buffer rawBody', () => {
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    const signature = crypto.createHmac('sha512', TEST_SECRET).update(rawBody).digest('hex');

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      signature,
    });

    expect(result.ok).toBe(true);
  });

  it('handles Uint8Array rawBody', () => {
    const buf = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    const rawBody = new Uint8Array(buf);
    const signature = crypto.createHmac('sha512', TEST_SECRET).update(buf).digest('hex');

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      signature,
    });

    expect(result.ok).toBe(true);
  });

  it('returns raw string when parseJson is false', () => {
    const { rawBody, signature } = createSignedPayload(SAMPLE_PAYLOAD);

    const result = verifyPaystackWebhook<string>(
      { rawBody, secret: TEST_SECRET, signature },
      { parseJson: false }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.payload).toBe('string');
      expect(JSON.parse(result.payload)).toEqual(SAMPLE_PAYLOAD);
    }
  });

  it('returns PAYHOOK_INVALID_JSON for non-JSON body with valid signature', () => {
    const rawBody = 'not json at all';
    const signature = crypto.createHmac('sha512', TEST_SECRET).update(rawBody).digest('hex');

    const result = verifyPaystackWebhook({
      rawBody,
      secret: TEST_SECRET,
      signature,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_JSON');
    }
  });
});

describe('verifyPaystackWebhookOrThrow', () => {
  it('returns payload on valid signature', () => {
    const { rawBody, signature } = createSignedPayload(SAMPLE_PAYLOAD);

    const payload = verifyPaystackWebhookOrThrow({
      rawBody,
      secret: TEST_SECRET,
      signature,
    });

    expect(payload.event).toBe('charge.success');
  });

  it('throws MissingHeaderError when no signature', () => {
    expect(() =>
      verifyPaystackWebhookOrThrow({ rawBody: '{}', secret: TEST_SECRET, headers: {} })
    ).toThrow(MissingHeaderError);
  });

  it('throws InvalidSignatureError for wrong signature', () => {
    expect(() =>
      verifyPaystackWebhookOrThrow({
        rawBody: JSON.stringify(SAMPLE_PAYLOAD),
        secret: TEST_SECRET,
        signature: 'deadbeef'.repeat(16),
      })
    ).toThrow(InvalidSignatureError);
  });

  it('throws InvalidJsonError for non-JSON body', () => {
    const rawBody = 'not json';
    const signature = crypto.createHmac('sha512', TEST_SECRET).update(rawBody).digest('hex');

    expect(() =>
      verifyPaystackWebhookOrThrow({ rawBody, secret: TEST_SECRET, signature })
    ).toThrow(InvalidJsonError);
  });
});

describe('computePaystackSignature', () => {
  it('produces a valid HMAC-SHA512 hex digest', () => {
    const body = '{"test":true}';
    const result = computePaystackSignature(body, TEST_SECRET);

    // HMAC-SHA512 produces 128 hex characters (64 bytes)
    expect(result).toMatch(/^[0-9a-f]{128}$/);

    // Verify against Node.js crypto directly
    const expected = crypto.createHmac('sha512', TEST_SECRET).update(body).digest('hex');
    expect(result).toBe(expected);
  });
});
