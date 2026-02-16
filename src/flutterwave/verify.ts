import { InvalidJsonError, InvalidSignatureError, MissingHeaderError } from '../errors.js';
import type { HttpHeaders, WebhookVerificationResult } from '../types.js';
import { getHeader, timingSafeEqualStrings, toBuffer } from '../utils.js';
import type { FlutterwaveWebhook } from './types.js';

export const FLUTTERWAVE_SIGNATURE_HEADER = 'verif-hash' as const;

export type VerifyFlutterwaveWebhookInput = {
  rawBody: string | Buffer | Uint8Array;
  secretHash: string;
  signature?: string;
  headers?: HttpHeaders;
};

export type VerifyFlutterwaveWebhookOptions = {

  parseJson?: boolean;
  signatureHeader?: string;
};



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
