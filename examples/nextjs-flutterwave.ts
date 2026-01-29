// Next.js App Router webhook handler for Flutterwave
// File: app/api/webhooks/flutterwave/route.ts

import { flutterwave } from 'payhook-ng';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const result = await flutterwave.verifyFlutterwaveRequest(
    req,
    process.env.FLUTTERWAVE_SECRET_HASH!
  );

  if (!result.ok) {
    console.error(`Webhook verification failed: ${result.code} - ${result.message}`);
    return new Response(result.message, { status: 400 });
  }

  const { event, data } = result.payload;

  switch (event) {
    case 'charge.completed':
      console.log(`Payment completed: ${data.tx_ref}, Amount: ${data.amount}`);
      break;
    default:
      console.log(`Unhandled event: ${event}`);
  }

  return new Response('ok');
}
