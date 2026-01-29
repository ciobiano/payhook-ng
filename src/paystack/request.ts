import type { WebhookVerificationResult } from '../types.js';
import type { PaystackWebhook } from './types.js';
import type { VerifyPaystackWebhookOptions } from './verify.js';
import { verifyPaystackWebhook, verifyPaystackWebhookOrThrow } from './verify.js';

/**
 * Next.js App Router friendly helper.
 *
 * Uses `request.arrayBuffer()` to preserve the exact request body bytes.
 * Note: this package uses `node:crypto`, so ensure your route runs in the Node.js runtime.
 */
export async function verifyPaystackRequest<TPayload = PaystackWebhook>(
  request: Request,
  secret: string,
  options: VerifyPaystackWebhookOptions = {}
): Promise<WebhookVerificationResult<TPayload, 'paystack'>> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);

  return verifyPaystackWebhook<TPayload>({ rawBody, secret, headers }, options);
}

export async function verifyPaystackRequestOrThrow<TPayload = PaystackWebhook>(
  request: Request,
  secret: string,
  options: VerifyPaystackWebhookOptions = {}
): Promise<TPayload> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);

  return verifyPaystackWebhookOrThrow<TPayload>({ rawBody, secret, headers }, options);
}
