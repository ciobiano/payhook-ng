import { InvalidJsonError, InvalidSignatureError, MissingHeaderError } from '../errors.js';
import type { HttpHeaders, WebhookVerificationResult } from '../types.js';
import type { FlutterwaveWebhook } from './types.js';

export const FLUTTERWAVE_SIGNATURE_HEADER = 'verif-hash' as const;

export type VerifyFlutterwaveWebhookInput = {
  /** Raw request body. */
  rawBody: string | Buffer | Uint8Array;
  /** Secret hash configured in the Flutterwave dashboard. */
  secretHash: string;
  /** If you already extracted the signature header value yourself. */
  signature?: string;
  /** Optional headers map. Used if `signature` isn't provided. */
  headers?: HttpHeaders;
};

export type VerifyFlutterwaveWebhookOptions = {
  /**
   * When true (default), JSON.parse is performed and returned in `payload`.
   * When false, `payload` will be the raw string.
   */
  parseJson?: boolean;
  /** The header name to read the signature from (defaults to verif-hash). */
  signatureHeader?: string;
};

function toBuffer(rawBody: VerifyFlutterwaveWebhookInput['rawBody']): Buffer {
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  if (Buffer.isBuffer(rawBody)) return rawBody;
  return Buffer.from(rawBody);
}

function getHeader(headers: HttpHeaders, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== target) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0];
    return undefined;
  }
  return undefined;
}

/**
 * Verifies a Flutterwave webhook signature and (optionally) parses JSON.
 *
 * Flutterwave uses a 'secret hash' mechanism where the `verif-hash` header
 * must match the secret hash you configured in your dashboard exactly.
 */
export function verifyFlutterwaveWebhook<TPayload = FlutterwaveWebhook>(
  input: VerifyFlutterwaveWebhookInput,
  options: VerifyFlutterwaveWebhookOptions = {}
): WebhookVerificationResult<TPayload, 'flutterwave'> {
  const signatureHeader = options.signatureHeader ?? FLUTTERWAVE_SIGNATURE_HEADER;

  const signature =
    input.signature ?? (input.headers ? getHeader(input.headers, signatureHeader) : undefined);

  if (!signature) {
    return {
      ok: false,
      provider: 'flutterwave',
      code: 'PAYHOOK_MISSING_HEADER',
      message: `Missing required header: ${signatureHeader}`
    };
  }

  // Flutterwave verification is a direct string comparison of the hash
  // It is not an HMAC of the body like Paystack.
  if (signature !== input.secretHash) {
    return {
      ok: false,
      provider: 'flutterwave',
      code: 'PAYHOOK_INVALID_SIGNATURE',
      message: 'Invalid Flutterwave webhook signature'
    };
  }

  const rawString = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : toBuffer(input.rawBody).toString('utf8');

  if (options.parseJson === false) {
    return { ok: true, provider: 'flutterwave', payload: rawString as unknown as TPayload };
  }

  try {
    const parsed = JSON.parse(rawString) as TPayload;
    return { ok: true, provider: 'flutterwave', payload: parsed };
  } catch (cause) {
    return {
      ok: false,
      provider: 'flutterwave',
      code: 'PAYHOOK_INVALID_JSON',
      message: 'Invalid JSON payload'
    };
  }
}

/**
 * Same as `verifyFlutterwaveWebhook`, but throws typed errors.
 */
export function verifyFlutterwaveWebhookOrThrow<TPayload = FlutterwaveWebhook>(
  input: VerifyFlutterwaveWebhookInput,
  options: VerifyFlutterwaveWebhookOptions = {}
): TPayload {
  const signatureHeader = options.signatureHeader ?? FLUTTERWAVE_SIGNATURE_HEADER;

  const signature =
    input.signature ?? (input.headers ? getHeader(input.headers, signatureHeader) : undefined);

  if (!signature) throw new MissingHeaderError(signatureHeader);

  if (signature !== input.secretHash) {
    throw new InvalidSignatureError('Invalid Flutterwave webhook signature');
  }

  const rawString = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : toBuffer(input.rawBody).toString('utf8');
  if (options.parseJson === false) return rawString as unknown as TPayload;

  try {
    return JSON.parse(rawString) as TPayload;
  } catch (cause) {
    throw new InvalidJsonError('Invalid JSON payload', cause);
  }
}
