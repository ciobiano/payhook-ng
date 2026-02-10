import { verify } from '../index.js';
import type { PayhookConfig } from '../index.js';
import type { HttpHeaders } from '../types.js';
import type { PaystackWebhook } from '../paystack/types.js';
import type { FlutterwaveWebhook } from '../flutterwave/types.js';

type NextRouteHandler = (request: Request) => Promise<Response> | Response;

/**
 * The handler receives the typed payload union — no `any`.
 *
 * You can narrow by checking the `event` field:
 *   if ('event' in payload && payload.event === 'charge.success') { ... }
 */
type PayhookHandler = (
  payload: PaystackWebhook | FlutterwaveWebhook,
  request: Request
) => Promise<Response> | Response;

export function withPayhook(config: PayhookConfig, handler: PayhookHandler): NextRouteHandler {
  return async (request: Request) => {
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const headers = Object.fromEntries(request.headers) as HttpHeaders;

    const result = await verify(rawBody, headers, config);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.code, message: result.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(result.payload, request);
  };
}
