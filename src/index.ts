import { verifyFlutterwaveWebhook, FLUTTERWAVE_SIGNATURE_HEADER } from './flutterwave/index.js';
import { verifyPaystackWebhook, PAYSTACK_SIGNATURE_HEADER } from './paystack/index.js';
import type { HttpHeaders, WebhookVerificationResult } from './types.js';
import type { IdempotencyStore } from './security/types.js';

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
 * Unified verification function that attempts to detect the provider from headers.
 *
 * NOTE: Idempotency is NOT automatically checked here because we need the payload first.
 * If you want idempotency, you should handle the result and check the ID, OR we need to parse here.
 *
 * Actually, to make it seamless, we can parse, then check ID, then return.
 */
export async function verify(
  rawBody: string | Buffer | Uint8Array,
  headers: HttpHeaders,
  config: PayhookConfig
): Promise<WebhookVerificationResult<any>> {
  let result: WebhookVerificationResult<any>;

  // Check for Paystack
  const paystackHeader = getHeader(headers, PAYSTACK_SIGNATURE_HEADER);
  if (paystackHeader && config.paystackSecret) {
    result = verifyPaystackWebhook({
      rawBody,
      headers,
      secret: config.paystackSecret
    });
  }
  // Check for Flutterwave
  else if (getHeader(headers, FLUTTERWAVE_SIGNATURE_HEADER) && config.flutterwaveSecretHash) {
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

  // If verification failed, return immediately
  if (!result.ok) return result;

  // Idempotency Check
  if (config.idempotencyStore) {
    const eventId = extractEventId(result.provider, result.payload);
    if (eventId) {
        const isReplay = await config.idempotencyStore.exists(eventId);
        if (isReplay) {
            return {
                ok: false,
                provider: result.provider,
                code: 'PAYHOOK_REPLAY_ATTACK',
                message: `Duplicate event ID detected: ${eventId}`
            };
        }
        await config.idempotencyStore.record(eventId, config.idempotencyTTL ?? 600);
    }
  }

  // Timestamp validation
  if (config.maxAgeSeconds && result.ok) {
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

  return result;
}

export function createPayhook(config: PayhookConfig) {
  return {
    verify: (rawBody: string | Buffer | Uint8Array, headers: HttpHeaders) =>
      verify(rawBody, headers, config),
  };
}

function extractEventId(provider: string, payload: any): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    
    // Paystack
    if (provider === 'paystack') {
        // usually data.id or data.reference
        // For events, Paystack sends `event` and `data`. The event ID is technically just `data.id`?
        // Actually, for webhook uniqueness, `event` + `data.id` is safer, or just `data.reference` for payments.
        // Let's use `data.id` as the unique event identifier if available.
        return payload.data?.id ? `paystack:${payload.data.id}` : undefined;
    }
    
    // Flutterwave
    if (provider === 'flutterwave') {
        // Flutterwave sends `id` in data mostly?
        // Flutterwave structure is { event, data: { id, ... } }
         return payload.data?.id ? `flutterwave:${payload.data.id}` : undefined;
    }

    return undefined;
}

function extractTimestamp(provider: string, payload: any): Date | undefined {
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
