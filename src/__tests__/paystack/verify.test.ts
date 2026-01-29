import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyPaystackWebhook, verifyPaystackWebhookOrThrow, computePaystackSignature } from '../../paystack/verify.js';
import { MissingHeaderError, InvalidSignatureError, InvalidJsonError } from '../../errors.js';

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

const TEST_SECRET = 'sk_test_abcdef1234567890';
const SAMPLE_PAYLOAD = JSON.stringify({
  event: 'charge.success',
  data: { id: 123, reference: 'ref_abc', amount: 50000, currency: 'NGN' }
});

describe('verifyPaystackWebhook', () => {
  it('should verify a valid signature', () => {
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const result = verifyPaystackWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      signature,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('paystack');
      expect(result.payload.event).toBe('charge.success');
    }
  });

  it('should reject an invalid signature', () => {
    const result = verifyPaystackWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      signature: 'definitely_not_valid',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
  });

  it('should fail when signature header is missing', () => {
    const result = verifyPaystackWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      headers: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_MISSING_HEADER');
  });

  it('should handle malformed JSON body', () => {
    const badBody = 'not json at all';
    const signature = sign(badBody, TEST_SECRET);
    const result = verifyPaystackWebhook({
      rawBody: badBody,
      secret: TEST_SECRET,
      signature,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_INVALID_JSON');
  });

  it('should extract signature from headers map (case-insensitive)', () => {
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const result = verifyPaystackWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      headers: { 'X-Paystack-Signature': signature },
    });
    expect(result.ok).toBe(true);
  });

  it('should return raw string when parseJson is false', () => {
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const result = verifyPaystackWebhook(
      { rawBody: SAMPLE_PAYLOAD, secret: TEST_SECRET, signature },
      { parseJson: false }
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.payload).toBe('string');
  });

  it('should work with Buffer input', () => {
    const body = Buffer.from(SAMPLE_PAYLOAD, 'utf8');
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const result = verifyPaystackWebhook({
      rawBody: body,
      secret: TEST_SECRET,
      signature,
    });
    expect(result.ok).toBe(true);
  });

  it('should work with Uint8Array input', () => {
    const body = new Uint8Array(Buffer.from(SAMPLE_PAYLOAD, 'utf8'));
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const result = verifyPaystackWebhook({
      rawBody: body,
      secret: TEST_SECRET,
      signature,
    });
    expect(result.ok).toBe(true);
  });
});

describe('verifyPaystackWebhookOrThrow', () => {
  it('should return payload on valid signature', () => {
    const signature = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const payload = verifyPaystackWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      signature,
    });
    expect(payload.event).toBe('charge.success');
  });

  it('should throw MissingHeaderError when signature is missing', () => {
    expect(() => verifyPaystackWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      headers: {},
    })).toThrow(MissingHeaderError);
  });

  it('should throw InvalidSignatureError on bad signature', () => {
    expect(() => verifyPaystackWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secret: TEST_SECRET,
      signature: 'bad',
    })).toThrow(InvalidSignatureError);
  });

  it('should throw InvalidJsonError on malformed JSON', () => {
    const badBody = 'not json';
    const signature = sign(badBody, TEST_SECRET);
    expect(() => verifyPaystackWebhookOrThrow({
      rawBody: badBody,
      secret: TEST_SECRET,
      signature,
    })).toThrow(InvalidJsonError);
  });
});

describe('computePaystackSignature', () => {
  it('should produce a valid HMAC SHA-512 hex string', () => {
    const sig = computePaystackSignature(SAMPLE_PAYLOAD, TEST_SECRET);
    expect(sig).toMatch(/^[a-f0-9]{128}$/);
  });

  it('should match crypto.createHmac output', () => {
    const expected = sign(SAMPLE_PAYLOAD, TEST_SECRET);
    const actual = computePaystackSignature(SAMPLE_PAYLOAD, TEST_SECRET);
    expect(actual).toBe(expected);
  });
});
