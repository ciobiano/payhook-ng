import crypto from 'node:crypto';

import { InvalidJsonError, InvalidSignatureError, MissingHeaderError } from '../errors.js';
import type { HttpHeaders, WebhookVerificationResult } from '../types.js';
import { getHeader, timingSafeEqualHex, toBuffer } from '../utils.js';
import type { PaystackWebhook } from './types.js';

export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature' as const;

export type VerifyPaystackWebhookInput = {
  /** Raw request body (exact bytes as received). */
  rawBody: string | Buffer | Uint8Array;
  /** Paystack secret key used to compute the signature. */
  secret: string;
  /** If you already extracted the signature header value yourself. */
  signature?: string;
  /** Optional headers map. Used if `signature` isn't provided. */
  headers?: HttpHeaders;
};

export type VerifyPaystackWebhookOptions = {
  /**
   * When true (default), JSON.parse is performed and returned in `payload`.
   * When false, `payload` will be the raw string.
   */
  parseJson?: boolean;
  /** The header name to read the signature from (defaults to x-paystack-signature). */
  signatureHeader?: string;
};

export function computePaystackSignature(rawBody: VerifyPaystackWebhookInput['rawBody'], secret: string): string {
  const buf = toBuffer(rawBody);
  return crypto.createHmac('sha512', secret).update(buf).digest('hex');
}

/**
 * Verifies a Paystack webhook signature and (optionally) parses JSON.
 *
 * This function returns a result object (no throw) to make it easy to use in route handlers.
 * If you prefer exceptions, use `verifyPaystackWebhookOrThrow`.
 */
export function verifyPaystackWebhook<TPayload = PaystackWebhook>(
  input: VerifyPaystackWebhookInput,
  options: VerifyPaystackWebhookOptions = {}
): WebhookVerificationResult<TPayload, 'paystack'> {
  const signatureHeader = options.signatureHeader ?? PAYSTACK_SIGNATURE_HEADER;

  const signature =
    input.signature ?? (input.headers ? getHeader(input.headers, signatureHeader) : undefined);

  if (!signature) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_MISSING_HEADER',
      message: `Missing required header: ${signatureHeader}`
    };
  }

  const expected = computePaystackSignature(input.rawBody, input.secret);
  const ok = timingSafeEqualHex(expected, signature);

  if (!ok) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_INVALID_SIGNATURE',
      message: 'Invalid Paystack webhook signature'
    };
  }

  const rawString = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : toBuffer(input.rawBody).toString('utf8');

  if (options.parseJson === false) {
    return { ok: true, provider: 'paystack', payload: rawString as unknown as TPayload };
  }

  try {
    const parsed = JSON.parse(rawString) as TPayload;
    return { ok: true, provider: 'paystack', payload: parsed };
  } catch (cause) {
    return {
      ok: false,
      provider: 'paystack',
      code: 'PAYHOOK_INVALID_JSON',
      message: 'Invalid JSON payload'
    };
  }
}

/**
 * Same as `verifyPaystackWebhook`, but throws typed errors.
 *
 * Delegates to verifyPaystackWebhook internally — one source of truth for
 * the verification logic.
 */
export function verifyPaystackWebhookOrThrow<TPayload = PaystackWebhook>(
  input: VerifyPaystackWebhookInput,
  options: VerifyPaystackWebhookOptions = {}
): TPayload {
  const result = verifyPaystackWebhook<TPayload>(input, options);

  if (!result.ok) {
    switch (result.code) {
      case 'PAYHOOK_MISSING_HEADER':
        throw new MissingHeaderError(options.signatureHeader ?? PAYSTACK_SIGNATURE_HEADER);
      case 'PAYHOOK_INVALID_JSON':
        throw new InvalidJsonError(result.message);
      default:
        throw new InvalidSignatureError(result.message);
    }
  }

  return result.payload;
}
