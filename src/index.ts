import { verifyFlutterwaveWebhook, FLUTTERWAVE_SIGNATURE_HEADER } from './flutterwave/index.js';
import type { FlutterwaveWebhook } from './flutterwave/types.js';
import { verifyPaystackWebhook, PAYSTACK_SIGNATURE_HEADER } from './paystack/index.js';
import type { PaystackWebhook } from './paystack/types.js';
import type { HttpHeaders, WebhookVerificationFailure, WebhookVerificationResult } from './types.js';
import type { IdempotencyStore } from './security/types.js';
import { getHeader } from './utils.js';

export * from './types.js';
export * from './errors.js';
export * from './security/types.js';
export * from './security/memory-store.js';
export * from './security/redis-store.js';

export * as paystack from './paystack/index.js';
export * as flutterwave from './flutterwave/index.js';

export type PayhookConfig = {
  /** Paystack secret key (starts with sk_). */
  paystackSecret?: string;
  /** Flutterwave secret hash (configured in dashboard). */
  flutterwaveSecretHash?: string;
  /**
   * Optional idempotency store to prevent replay attacks.
   * If provided, the verification logic will check if the event ID has been seen.
   */
  idempotencyStore?: IdempotencyStore;
  /**
   * TTL in seconds for idempotency check (default: 600s / 10m).
   */
  idempotencyTTL?: number;
  /**
   * Maximum age in seconds for a webhook event.
   * Events older than this are rejected as stale.
   */
  maxAgeSeconds?: number;
};

/**
 * The union of all possible return types from verify().
 *
 * Consumers can narrow by checking result.provider after result.ok === true:
 *   if (result.ok && result.provider === 'paystack') → result.payload is PaystackWebhook
 */
export type UnifiedVerificationResult =
  | WebhookVerificationResult<PaystackWebhook, 'paystack'>
  | WebhookVerificationResult<FlutterwaveWebhook, 'flutterwave'>
  | WebhookVerificationFailure;

/**
 * Unified verification function that detects the provider from headers.
 *
 * Order of operations (important for correctness):
 * 1. Detect provider and verify signature
 * 2. Parse payload
 * 3. Validate timestamp (reject stale events) — BEFORE recording
 * 4. Record in idempotency store — AFTER all validation passes
 *
 * Why this order? If we recorded before timestamp validation, a stale event
 * would consume a slot in the idempotency store and could never be retried.
 * Side effects (recording) must come after all validation gates.
 */
export async function verify(
  rawBody: string | Buffer | Uint8Array,
  headers: HttpHeaders,
  config: PayhookConfig
): Promise<UnifiedVerificationResult> {
  // Step 1: Detect provider and verify signature
  let result: WebhookVerificationResult<PaystackWebhook, 'paystack'> | WebhookVerificationResult<FlutterwaveWebhook, 'flutterwave'>;

  const paystackHeader = getHeader(headers, PAYSTACK_SIGNATURE_HEADER);
  if (paystackHeader && config.paystackSecret) {
    result = verifyPaystackWebhook({
      rawBody,
      headers,
      secret: config.paystackSecret
    });
  } else if (getHeader(headers, FLUTTERWAVE_SIGNATURE_HEADER) && config.flutterwaveSecretHash) {
    result = verifyFlutterwaveWebhook({
      rawBody,
      headers,
      secretHash: config.flutterwaveSecretHash
    });
  } else {
    return {
      ok: false,
      code: 'PAYHOOK_UNKNOWN_PROVIDER',
      message: 'Could not detect webhook provider from headers'
    };
  }

  // Step 2: If signature verification failed, stop here
  if (!result.ok) return result;

  // Step 3: Validate timestamp BEFORE recording (reject stale events)
  if (config.maxAgeSeconds) {
    const createdAt = extractTimestamp(result.provider, result.payload);
    if (createdAt) {
      const ageSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (ageSeconds > config.maxAgeSeconds) {
        return {
          ok: false,
          provider: result.provider,
          code: 'PAYHOOK_STALE_EVENT',
          message: `Event is ${Math.round(ageSeconds)}s old, exceeds max age of ${config.maxAgeSeconds}s`
        };
      }
    }
  }

  // Step 4: Idempotency check AFTER all validation passes
  if (config.idempotencyStore) {
    const eventId = extractEventId(result.provider, result.payload);
    if (eventId) {
      const isNew = await config.idempotencyStore.recordIfAbsent(
        eventId,
        config.idempotencyTTL ?? 600
      );
      if (!isNew) {
        return {
          ok: false,
          provider: result.provider,
          code: 'PAYHOOK_REPLAY_ATTACK',
          message: `Duplicate event ID detected: ${eventId}`
        };
      }
    }
  }

  return result;
}

export function createPayhook(config: PayhookConfig) {
  return {
    verify: (rawBody: string | Buffer | Uint8Array, headers: HttpHeaders) =>
      verify(rawBody, headers, config),
  };
}

/**
 * Extracts a unique event identifier for idempotency.
 * Prefixed with provider name to avoid cross-provider collisions.
 */
function extractEventId(provider: 'paystack' | 'flutterwave', payload: Record<string, any>): string | undefined {
  const id = payload?.data?.id;
  if (id === undefined || id === null) return undefined;
  return `${provider}:${id}`;
}

function extractTimestamp(provider: 'paystack' | 'flutterwave', payload: Record<string, any>): Date | undefined {
  if (provider === 'paystack') {
    const ts = payload?.data?.created_at || payload?.data?.paid_at;
    return ts ? new Date(ts) : undefined;
  }
  if (provider === 'flutterwave') {
    const ts = payload?.data?.created_at;
    return ts ? new Date(ts) : undefined;
  }
  return undefined;
}
