// Using the unified verify() API with auto-detection
// This single endpoint handles both Paystack and Flutterwave webhooks

import { createPayhook, InMemoryIdempotencyStore } from 'payhook-ng';

// Configure once at startup
const payhook = createPayhook({
  paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
  flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
  idempotencyStore: new InMemoryIdempotencyStore(),
  idempotencyTTL: 600,
  maxAgeSeconds: 3600,
});

// Next.js App Router handler
export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  const result = await payhook.verify(rawBody, headers);

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.code }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // result.provider tells you which payment provider sent the webhook
  switch (result.provider) {
    case 'paystack':
      console.log('Paystack event:', result.payload.event);
      break;
    case 'flutterwave':
      console.log('Flutterwave event:', result.payload.event);
      break;
  }

  return new Response('ok');
}
