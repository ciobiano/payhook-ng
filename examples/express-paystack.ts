// Express webhook handler for Paystack and Flutterwave
// IMPORTANT: Use express.raw() so the body is a Buffer, not parsed JSON

import express from 'express';
import { payhookMiddleware } from 'payhook-ng/express';

const app = express();

app.post(
  '/webhooks',
  express.raw({ type: 'application/json' }),
  payhookMiddleware({
    paystackSecret: process.env.PAYSTACK_SECRET_KEY!,
    flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH!,
  }),
  (req: any, res: any) => {
    const payload = req.webhook;
    console.log('Verified webhook payload:', payload);
    res.sendStatus(200);
  }
);

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
