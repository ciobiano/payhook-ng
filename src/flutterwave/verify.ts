import { InvalidJsonError, InvalidSignatureError, MissingHeaderError } from '../errors.js';
import type { HttpHeaders, WebhookVerificationResult } from '../types.js';
import { getHeader, timingSafeEqualStrings, toBuffer } from '../utils.js';
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

  // Flutterwave uses direct secret hash comparison (not HMAC).
  // We MUST use timing-safe comparison to prevent timing oracle attacks.
  if (!timingSafeEqualStrings(signature, input.secretHash)) {
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
 *
 * Delegates to verifyFlutterwaveWebhook internally — one source of truth for
 * the verification logic. If you fix a bug in verify, it's automatically
 * fixed here too.
 */
export function verifyFlutterwaveWebhookOrThrow<TPayload = FlutterwaveWebhook>(
  input: VerifyFlutterwaveWebhookInput,
  options: VerifyFlutterwaveWebhookOptions = {}
): TPayload {
  const result = verifyFlutterwaveWebhook<TPayload>(input, options);

  if (!result.ok) {
    switch (result.code) {
      case 'PAYHOOK_MISSING_HEADER':
        throw new MissingHeaderError(options.signatureHeader ?? FLUTTERWAVE_SIGNATURE_HEADER);
      case 'PAYHOOK_INVALID_JSON':
        throw new InvalidJsonError(result.message);
      default:
        throw new InvalidSignatureError(result.message);
    }
  }

  return result.payload;
}
