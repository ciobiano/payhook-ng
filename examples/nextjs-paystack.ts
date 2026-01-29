// Next.js App Router webhook handler for Paystack
// File: app/api/webhooks/paystack/route.ts

import { paystack } from 'payhook-ng';

// Required because this package uses node:crypto
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const result = await paystack.verifyPaystackRequest(
    req,
    process.env.PAYSTACK_SECRET_KEY!
  );

  if (!result.ok) {
    console.error(`Webhook verification failed: ${result.code} - ${result.message}`);
    return new Response(result.message, { status: 400 });
  }

  const { event, data } = result.payload;

  switch (event) {
    case 'charge.success':
      // Handle successful charge
      console.log(`Payment received: ${data.reference}, Amount: ${data.amount}`);
      break;
    default:
      console.log(`Unhandled event: ${event}`);
  }

  return new Response('ok');
}
