import { describe, it, expect } from 'vitest';
import { verifyFlutterwaveWebhook, verifyFlutterwaveWebhookOrThrow } from '../../flutterwave/verify.js';
import { MissingHeaderError, InvalidSignatureError, InvalidJsonError } from '../../errors.js';

const TEST_SECRET_HASH = 'my_flutterwave_secret_hash_12345';
const SAMPLE_PAYLOAD = JSON.stringify({
  event: 'charge.completed',
  data: { id: 456, tx_ref: 'tx_ref_abc', amount: 5000, currency: 'NGN', status: 'successful' }
});

describe('verifyFlutterwaveWebhook', () => {
  it('should verify when hash matches', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('flutterwave');
      expect(result.payload.event).toBe('charge.completed');
    }
  });

  it('should reject when hash does not match', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      signature: 'wrong_hash',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_INVALID_SIGNATURE');
  });

  it('should fail when verif-hash header is missing', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      headers: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_MISSING_HEADER');
  });

  it('should handle malformed JSON body', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: 'not json',
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PAYHOOK_INVALID_JSON');
  });

  it('should be case-sensitive for hash comparison', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH.toUpperCase(),
    });
    // Flutterwave uses exact string match, so different case should fail
    expect(result.ok).toBe(false);
  });

  it('should extract signature from headers map (case-insensitive header name)', () => {
    const result = verifyFlutterwaveWebhook({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      headers: { 'Verif-Hash': TEST_SECRET_HASH },
    });
    expect(result.ok).toBe(true);
  });

  it('should return raw string when parseJson is false', () => {
    const result = verifyFlutterwaveWebhook(
      { rawBody: SAMPLE_PAYLOAD, secretHash: TEST_SECRET_HASH, signature: TEST_SECRET_HASH },
      { parseJson: false }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.payload).toBe('string');
      expect(result.payload).toBe(SAMPLE_PAYLOAD);
    }
  });

  it('should work with Buffer input', () => {
    const body = Buffer.from(SAMPLE_PAYLOAD, 'utf8');
    const result = verifyFlutterwaveWebhook({
      rawBody: body,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });
    expect(result.ok).toBe(true);
  });

  it('should work with Uint8Array input', () => {
    const body = new Uint8Array(Buffer.from(SAMPLE_PAYLOAD, 'utf8'));
    const result = verifyFlutterwaveWebhook({
      rawBody: body,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });
    expect(result.ok).toBe(true);
  });
});

describe('verifyFlutterwaveWebhookOrThrow', () => {
  it('should return payload when hash matches', () => {
    const payload = verifyFlutterwaveWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    });
    expect(payload.event).toBe('charge.completed');
  });

  it('should throw MissingHeaderError when signature is missing', () => {
    expect(() => verifyFlutterwaveWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      headers: {},
    })).toThrow(MissingHeaderError);
  });

  it('should throw InvalidSignatureError on bad hash', () => {
    expect(() => verifyFlutterwaveWebhookOrThrow({
      rawBody: SAMPLE_PAYLOAD,
      secretHash: TEST_SECRET_HASH,
      signature: 'bad',
    })).toThrow(InvalidSignatureError);
  });

  it('should throw InvalidJsonError on malformed JSON', () => {
    expect(() => verifyFlutterwaveWebhookOrThrow({
      rawBody: 'not json',
      secretHash: TEST_SECRET_HASH,
      signature: TEST_SECRET_HASH,
    })).toThrow(InvalidJsonError);
  });
});
