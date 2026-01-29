import { verify } from '../index.js';
import type { PayhookConfig } from '../index.js';
import type { HttpHeaders } from '../types.js';

type NextRouteHandler = (request: Request) => Promise<Response> | Response;
type PayhookHandler = (payload: any, request: Request) => Promise<Response> | Response;

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
