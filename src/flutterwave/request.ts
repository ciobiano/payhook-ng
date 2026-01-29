import type { WebhookVerificationResult } from '../types.js';
import type { FlutterwaveWebhook } from './types.js';
import type { VerifyFlutterwaveWebhookOptions } from './verify.js';
import { verifyFlutterwaveWebhook, verifyFlutterwaveWebhookOrThrow } from './verify.js';

/**
 * Next.js App Router friendly helper for Flutterwave webhooks.
 *
 * Uses `request.arrayBuffer()` to preserve the exact request body bytes.
 */
export async function verifyFlutterwaveRequest<TPayload = FlutterwaveWebhook>(
  request: Request,
  secretHash: string,
  options: VerifyFlutterwaveWebhookOptions = {}
): Promise<WebhookVerificationResult<TPayload, 'flutterwave'>> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);

  return verifyFlutterwaveWebhook<TPayload>({ rawBody, secretHash, headers }, options);
}

export async function verifyFlutterwaveRequestOrThrow<TPayload = FlutterwaveWebhook>(
  request: Request,
  secretHash: string,
  options: VerifyFlutterwaveWebhookOptions = {}
): Promise<TPayload> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);

  return verifyFlutterwaveWebhookOrThrow<TPayload>({ rawBody, secretHash, headers }, options);
}
