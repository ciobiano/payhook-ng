import { describe, it, expect } from 'vitest';
import {
  verifyFlutterwaveWebhook,
  verifyFlutterwaveWebhookOrThrow,
  FLUTTERWAVE_SIGNATURE_HEADER,
} from './verify.js';
import { MissingHeaderError, InvalidSignatureError, InvalidJsonError } from '../errors.js';

const TEST_SECRET_HASH = 'my-flutterwave-secret-hash-xyz';

const SAMPLE_PAYLOAD = {
  event: 'charge.completed',
  data: {
    id: 67890,
    tx_ref: 'tx_ref_abc',
    flw_ref: 'flw_ref_xyz',
    amount: 10000,
    currency: 'NGN',
    created_at: '2026-01-15T10:30:00.000Z',
  },
};

describe('verifyFlutterwaveWebhook', () => {
  it('accepts a valid secret hash', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('flutterwave');
      expect(result.payload.event).toBe('charge.completed');
    }
  });

  it('accepts when signature is in headers map', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      headers: { [FLUTTERWAVE_SIGNATURE_HEADER]: TEST_SECRET_HASH },
    });

    expect(result.ok).toBe(true);
  });

  it('handles case-insensitive header lookup', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      headers: { 'Verif-Hash': TEST_SECRET_HASH },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects when signature header is missing', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      headers: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_MISSING_HEADER');
    }
  });

  it('rejects wrong secret hash', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      signature: 'wrong-hash-value',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
    }
  });

  it('rejects hash that is a prefix of the real hash (timing attack vector)', () => {
    // If we used ===, a partial prefix wouldn't help.
    // But with timingSafeEqual, we also verify length mismatch is rejected.
    const result = verifyFlutterwaveWebhook({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH.slice(0, -1), // one char short
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
    }
  });

  it('returns raw string when parseJson is false', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const result = verifyFlutterwaveWebhook<string>(
      { rawBody, secretHash: TEST_SECRET_HASH, signature: TEST_SECRET_HASH },
      { parseJson: false }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.payload).toBe('string');
    }
  });

  it('returns PAYHOOK_INVALID_JSON for non-JSON body', () => {
    const rawBody = 'definitely not json';
    const result = verifyFlutterwaveWebhook({
      rawBody,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYHOOK_INVALID_JSON');
    }
  });
});

describe('verifyFlutterwaveWebhookOrThrow', () => {
  it('returns payload on valid hash', () => {
    const payload = verifyFlutterwaveWebhookOrThrow({
      rawBody: JSON.stringify(SAMPLE_PAYLOAD),
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });

    expect(payload.event).toBe('charge.completed');
  });

  it('throws MissingHeaderError when no signature', () => {
    expect(() =>
      verifyFlutterwaveWebhookOrThrow({
        rawBody: '{}',
        secretHash: TEST_SECRET_HASH,
        headers: {},
      })
    ).toThrow(MissingHeaderError);
  });

  it('throws InvalidSignatureError for wrong hash', () => {
    expect(() =>
      verifyFlutterwaveWebhookOrThrow({
        rawBody: JSON.stringify(SAMPLE_PAYLOAD),
        secretHash: TEST_SECRET_HASH,
        signature: 'wrong',
      })
    ).toThrow(InvalidSignatureError);
  });

  it('throws InvalidJsonError for non-JSON body', () => {
    expect(() =>
      verifyFlutterwaveWebhookOrThrow({
        rawBody: 'not json',
        secretHash: TEST_SECRET_HASH,
        signature: TEST_SECRET_HASH,
      })
    ).toThrow(InvalidJsonError);
  });
});
